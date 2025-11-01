"use client";

export default function Error({ error }: { error: Error }) {
  return <div className="text-red-600">Failed to load orders: {error.message}</div>;
}
