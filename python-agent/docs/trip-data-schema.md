# 行程与 POI 数据约定（Mongo + PostgreSQL）

本文件约定**唯一权威形状**：爬虫、灌库、Agent、Next API 均按此对齐。不做旧数据兼容。

## 存储位置

| 数据 | 库 / 集合或表 |
|------|----------------|
| 用户、行程文档、游记 | MongoDB 数据库 `trip`：`Users`、`Trips`、`TravelBlogs` |
| 景点 / 酒店 / 餐厅目录、坐标、向量 | PostgreSQL：`attraction_vectors`、`hotel_vectors`、`restaurant_vectors`（与 [`scripts/init-pg-vector.sql`](../../scripts/init-pg-vector.sql)、[`002_restaurant_vectors.sql`](../migrations/002_restaurant_vectors.sql) 一致；代码中 [`pg_vector_store`](../app/services/pg_vector_store.py) 可能对 `attractions` / `hotels` / `restaurants` 做 fallback 查询） |

## MongoDB：`Trips` 文档（持久化）

根字段（与 Agent `build_trip_response` 对齐）：

- `id`：string（UUID，业务主键）
- `userId`、`title`、`destination`、`startDate`、`endDate`、`travelers`、`budget`、`travelStyle`、`status`
- `highlights`、`recommendations`、`practicalInfo`、`estimatedCost`
- **`selectedHotelId`**：string，对应 PG `hotel_vectors.hotel_id`（**不**在 Mongo 存酒店名称/图片）
- **`hotelNightlyCost`** / **`hotelTotalCost`**（可选）：整数，预算与展示用金额，非 POI 详情
- **`alternatives`**：`{ attractions[], hotels[], restaurants[] }`，每项为带 `*Id` 与摘要字段的对象（与 Agent 一致）
- `days[]`：`{ day, title, activities[] }`
- `createdAt`、`updatedAt`

### `days[].activities[]`

| 字段 | 说明 |
|------|------|
| `time` | 时段字符串 |
| **`from`** | `recommendation` \| `restaurant` \| `hotel` \| `others` |
| **`id`** | 可选。有 PG 关联时：景点/餐厅/酒店表主键字符串；`others` 可无 |
| `title`、`description`、`location` | 仅 **`from === "others"`** 或**无 id** 时使用 |
| `priceYuan` | 可选 |

**禁止**在持久化文档中使用已废弃字段：`type`、`ref`。

## PostgreSQL：POI 表（字段级摘要）

### `attraction_vectors`

`attraction_id`、`name`、`location`、`rating`、`type`、`description`、`image_url`、`likes`、`latitude`、`longitude`、`coordinate_type`、`embedding`、`metadata`、时间戳。

主键业务字段：`attraction_id`（脚本中为 INTEGER；业务 id 统一按字符串查询，见 `pg_vector_store`）。

### `hotel_vectors`

`hotel_id`、`name`、`location`、`rating`、`price_yuan`、`price_display`、`address`、`position_desc`、`image_url`、`latitude`、`longitude`、`embedding`、`metadata`、时间戳等（见 init SQL）。

### `restaurant_vectors`

`restaurant_id`、`name`、`location`、`type`、`description`、`rating`、`price_yuan`、`latitude`、`longitude`、`embedding`、`created_at`。

## `/v1/trips/locations` 响应

在请求体 `trip` 基础上为活动补全 `coordinate`、`title`、`description`、`location`（来自 PG）；根级可附加 **`selectedHotel`** 视图（仅响应，不写回 Mongo）。详见 [`location_tools.py`](../app/services/location_tools.py)。
