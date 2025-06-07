import { NextResponse } from "next/server";
import clientPromise from "@/lib/db";

// 处理 GET 请求
export async function GET(request: Request) {
  try {
    // 等待数据库连接成功
    const client = await clientPromise;
    const db = client.db("trip");
    const collection = db.collection("Recomendations");

    // 查询所有数据（可以根据需要加筛选条件）
    const results = await collection.find({}).toArray();

    // 返回查询结果为 JSON
    return NextResponse.json(results);
  } catch (err) {
    console.error("❌ Failed to fetch recommendations:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
