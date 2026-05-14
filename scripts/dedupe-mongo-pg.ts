#!/usr/bin/env tsx
/**
 * 清洗 MongoDB / PostgreSQL 中的重复 POI 数据（与爬虫 upsert 键一致）。
 *
 * Mongo：
 *   - Recomendations：同一 id（景点 poiId）只保留 _id 最大的一条
 *   - Hotels：同一 (cityId + hotelId) 只保留 _id 最大的一条
 *   - Restaurants：有 source+sourceId 时按二者；否则按 id
 *
 * PostgreSQL（表存在才执行）：
 *   - attraction_vectors / attractions：attraction_id 重复时保留 id 最大行
 *   - hotel_vectors：hotel_id 重复时保留 id 最大行
 *   - hotels / restaurants（v3 仅主键、无自增 id）：脚本会跳过 PG 去重
 *
 * 用法（仓库根目录，依赖 .env.local 或环境变量）：
 *   pnpm exec tsx scripts/dedupe-mongo-pg.ts
 *   pnpm exec tsx scripts/dedupe-mongo-pg.ts --dry-run
 */
import "./load-env-local"
import type { Collection, Document, ObjectId } from "mongodb"
import clientPromise, { MONGODB_DB_NAME } from "../lib/db"
import { getPostgresPool } from "../lib/db-pg"

const dryRun = process.argv.includes("--dry-run")

function newestObjectId(ids: ObjectId[]): ObjectId {
  return ids.reduce((a, b) => (a.toString() > b.toString() ? a : b))
}

async function dedupeMongoGroup(
  coll: Collection<Document>,
  label: string,
  groups: { key: string; ids: ObjectId[] }[],
  dry: boolean
): Promise<number> {
  let removed = 0
  for (const g of groups) {
    if (g.ids.length < 2) continue
    const keep = newestObjectId(g.ids)
    const drop = g.ids.filter((id) => !id.equals(keep))
    removed += drop.length
    if (!dry && drop.length) {
      await coll.deleteMany({ _id: { $in: drop } })
    }
  }
  if (groups.length) {
    console.log(`  Mongo ${label}: 重复组 ${groups.length}，将删除文档 ${removed} 条${dry ? "（dry-run 未删）" : ""}`)
  }
  return removed
}

async function dedupeMongoRecommendations(coll: Collection<Document>) {
  const dup = await coll
    .aggregate<{ _id: number; ids: ObjectId[] }>([
      { $match: { id: { $exists: true, $ne: null } } },
      { $group: { _id: "$id", ids: { $push: "$_id" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray()
  const groups = dup.map((d) => ({ key: String(d._id), ids: d.ids }))
  if (groups.length === 0) {
    console.log("  Mongo Recomendations(id): 无重复")
    return 0
  }
  return dedupeMongoGroup(coll, "Recomendations(id)", groups, dryRun)
}

async function dedupeMongoHotels(coll: Collection<Document>) {
  const dup = await coll
    .aggregate<{ _id: { cityId: unknown; hotelId: unknown }; ids: ObjectId[] }>([
      { $match: { hotelId: { $exists: true, $nin: [null, ""] } } },
      {
        $group: {
          _id: { cityId: "$cityId", hotelId: "$hotelId" },
          ids: { $push: "$_id" },
          n: { $sum: 1 },
        },
      },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray()
  const groups = dup.map((d) => ({
    key: `${d._id.cityId}:${d._id.hotelId}`,
    ids: d.ids,
  }))
  if (groups.length === 0) {
    console.log("  Mongo Hotels(cityId+hotelId): 无重复")
    return 0
  }
  return dedupeMongoGroup(coll, "Hotels(cityId+hotelId)", groups, dryRun)
}

async function dedupeMongoRestaurants(coll: Collection<Document>) {
  const withSource = await coll
    .aggregate<{ _id: { source: string; sourceId: string }; ids: ObjectId[] }>([
      { $match: { source: { $exists: true }, sourceId: { $exists: true, $nin: [null, ""] } } },
      {
        $group: {
          _id: { source: "$source", sourceId: "$sourceId" },
          ids: { $push: "$_id" },
          n: { $sum: 1 },
        },
      },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray()

  let removed = 0
  const g1 = withSource.map((d) => ({
    key: `${d._id.source}:${d._id.sourceId}`,
    ids: d.ids,
  }))
  if (g1.length) {
    removed += await dedupeMongoGroup(coll, "Restaurants(source+sourceId)", g1, dryRun)
  }

  const byNumericId = await coll
    .aggregate<{ _id: number; ids: ObjectId[] }>([
      {
        $match: {
          $or: [{ source: { $exists: false } }, { sourceId: { $exists: false } }, { sourceId: "" }],
          id: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: "$id", ids: { $push: "$_id" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray()

  const g2 = byNumericId.map((d) => ({ key: String(d._id), ids: d.ids }))
  if (g2.length) {
    removed += await dedupeMongoGroup(coll, "Restaurants(id)", g2, dryRun)
  }
  if (g1.length === 0 && g2.length === 0) {
    console.log("  Mongo Restaurants: 无重复")
  }
}

async function pgTableExists(table: string): Promise<boolean> {
  const pool = getPostgresPool()
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [table]
  )
  return Boolean(rows[0]?.exists)
}

async function pgHasColumn(table: string, column: string): Promise<boolean> {
  const pool = getPostgresPool()
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    ) AS exists`,
    [table, column]
  )
  return Boolean(rows[0]?.exists)
}

/** 按业务键去重：有自增 id 时保留每组 id 最大行；仅主键表跳过（设计上无重复行） */
async function dedupePgTable(table: string, keyColumn: string): Promise<number> {
  if (!(await pgTableExists(table))) {
    console.log(`  PG 跳过（表不存在）: ${table}`)
    return 0
  }
  if (!(await pgHasColumn(table, "id"))) {
    console.log(`  PG 跳过（无自增 id 列，主键表通常无重复）: ${table}`)
    return 0
  }
  const pool = getPostgresPool()
  const countSql = `
    SELECT COUNT(*)::int AS c FROM (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY ${keyColumn} ORDER BY id DESC) AS rn
        FROM ${table}
      ) t WHERE rn > 1
    ) x`
  const { rows: countRows } = await pool.query<{ c: number }>(countSql)
  const toDelete = countRows[0]?.c ?? 0
  if (toDelete === 0) {
    console.log(`  PG ${table}.${keyColumn}: 无重复`)
    return 0
  }
  if (dryRun) {
    console.log(`  PG ${table}.${keyColumn}: 将删除 ${toDelete} 行（dry-run）`)
    return toDelete
  }
  const delSql = `
    DELETE FROM ${table}
    WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY ${keyColumn} ORDER BY id DESC) AS rn
        FROM ${table}
      ) t WHERE rn > 1
    )`
  const res = await pool.query(delSql)
  console.log(`  PG ${table}.${keyColumn}: 已删除 ${res.rowCount ?? 0} 行`)
  return res.rowCount ?? 0
}

async function main() {
  console.log(dryRun ? "🔍 dedupe-mongo-pg（dry-run，不写库）" : "🧹 dedupe-mongo-pg")

  const mongo = await clientPromise
  const db = mongo.db(MONGODB_DB_NAME)

  console.log("\n--- MongoDB ---")
  const rec = db.collection("Recomendations")
  const hotels = db.collection("Hotels")
  const rests = db.collection("Restaurants")

  await dedupeMongoRecommendations(rec)
  await dedupeMongoHotels(hotels)
  await dedupeMongoRestaurants(rests)

  console.log("\n--- PostgreSQL ---")
  await dedupePgTable("attraction_vectors", "attraction_id")
  await dedupePgTable("attractions", "attraction_id")
  await dedupePgTable("hotel_vectors", "hotel_id")
  await dedupePgTable("hotels", "hotel_id")
  await dedupePgTable("restaurant_vectors", "restaurant_id")
  await dedupePgTable("restaurants", "restaurant_id")

  await mongo.close()
  const pool = getPostgresPool()
  await pool.end()

  console.log(dryRun ? "\n✅ 预览结束" : "\n✅ 清洗完成")
}

main().catch((e) => {
  console.error("❌ 清洗失败:", e)
  process.exit(1)
})
