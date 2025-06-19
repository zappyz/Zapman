'use client';

import { useState } from "react";
import { fetchAPI, ApiResponse } from "./utils/fetchAPI";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);

    const res = await fetchAPI({
      url,
      method,
      body: body || undefined,
      headers: { 'Content-Type': 'application/json' }
    });

    setResponse(res);
    setLoading(false);
  };

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mini Postman</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="https://api.example.com/endpoint"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="border p-2 rounded"
        >
          {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        {["POST", "PUT", "PATCH"].includes(method) && (
          <textarea
            placeholder='Request body (JSON)'
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full border p-2 rounded h-32"
          />
        )}
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          {loading ? "Sending..." : "Send Request"}
        </button>
      </form>

      {response && (
        <div className="mt-6 border-t pt-4">
          <h2 className="text-xl font-semibold mb-2">Response</h2>
          <p>Status: {response.status} {response.statusText}</p>
          <p>Time: {response.durationMs}ms</p>
          <pre className="bg-gray-100 p-4 rounded overflow-auto mt-2 text-sm">
            {typeof response.body === "object"
              ? JSON.stringify(response.body, null, 2)
              : response.body}
          </pre>
        </div>
      )}
      {response?.error && (
        <p className="text-red-600 mt-2">Error: {response.error}</p>
      )}
    </main>
  );
}