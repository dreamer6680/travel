import { NextResponse } from "next/server"
import clientPromise from "@/lib/db";

export async function GET(request: Request) {
  // 在实际应用中，这里会从数据库获取数据
  const client = await clientPromise;
  const db = client.db("trip");
  const collection = db.collection("Recomendations");

  const results = await collection.find({ likes: { $gt: 300 } }).sort({ likes: -1 }).toArray();

  return NextResponse.json(results)
}
