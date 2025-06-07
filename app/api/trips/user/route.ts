import { NextResponse } from "next/server"
import clientPromise from "@/lib/db"


export async function GET(request: Request) {
  // 在实际应用中，这里会从数据库获取用户的所有行程
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  const client = await clientPromise;
  const db = client.db("trip");
  const collection = db.collection("Trips");

  const results = await collection.find({ userId: userId }).toArray();

  return NextResponse.json(results)
}
