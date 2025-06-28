'use client';

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { fetchAPI, ApiResponse } from "./utils/fetchAPI";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, TooltipProps } from "recharts";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [headers, setHeaders] = useState([{ key: "", value: "" }]);
  const [viewMode, setViewMode] = useState<"json" | "xml" | "html">("json");
  const [copied, setCopied] = useState(false);

  type HistoryEntry = {
    url: string;
    method: string;
    durationMs: number;
    timestamp: number;
  };

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);

    const headersObj: Record<string, string> = {};
    headers.forEach(({ key, value }) => {
      if (key) headersObj[key] = value;
    });

    const isJson = headersObj['Content-Type'] === 'application/json';

    try {
      const res = await fetchAPI({
        url,
        method,
        headers: headersObj,
        body: isJson ? safeJsonParse(body) : body,
        includeRawText: true,
      });

      setResponse(res);

      setHistory(prev => [
        ...prev.slice(-19),
        {
          url,
          method,
          timestamp: Date.now(),
          durationMs: res.durationMs,
        }
      ]);

      Sentry.addBreadcrumb({
        category: "http",
        message: `Requested ${url} (${method})`,
        level: "info",
      });

      if (!res.ok) {
        Sentry.captureMessage(`Non-2xx response: ${res.status} from ${url}`);
      }

    } catch (err) {
      Sentry.captureException(err);
      console.error("Fetch error:", err);
    }

    setLoading(false);
    setViewMode("json");
  };

  const safeJsonParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const updateHeader = (index: number, key: "key" | "value", value: string) => {
    const newHeaders = [...headers];
    newHeaders[index][key] = value;
    setHeaders(newHeaders);
  };

  const addHeaderField = () => setHeaders([...headers, { key: "", value: "" }]);

  const removeHeaderField = (index: number) => {
    const newHeaders = headers.filter((_, i) => i !== index);
    setHeaders(newHeaders);
  };
  
  const jsonToXml = (obj: Record<string, unknown>, indent = ""): string => {
    let xml = "";
    for (const prop in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, prop)) continue;
      const value = obj[prop];
      
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        xml += `${indent}<${prop}>\n${jsonToXml(value as Record<string, unknown>, indent + "  ")}${indent}</${prop}>\n`;
      } else {
        xml += `${indent}<${prop}>${value}</${prop}>\n`;
      }
    }
    return xml;
  };

  const formatXml = (xml: string) => {
    return xml.trim();
  };

  const renderBody = () => {
    if (!response) return null;

    if (viewMode === "json") {
      let jsonObj = response.body;
      if (typeof jsonObj === "string") {
        try {
          jsonObj = JSON.parse(jsonObj);
        } catch {
          // ignore
        }
      }
      return (
        <pre className="bg-black/30 p-3 rounded text-sm overflow-auto mt-1">
          {typeof jsonObj === "object" ? JSON.stringify(jsonObj, null, 2) : String(jsonObj)}
        </pre>
      );
    }

    if (viewMode === "xml") {
      let xmlStr = "";
      if (typeof response.body === "object") {
        xmlStr = formatXml(jsonToXml(response.body));
      } else if (typeof response.rawText === "string") {
        xmlStr = formatXml(response.rawText);
      } else {
        xmlStr = String(response.body);
      }
      return (
        <pre className="bg-black/30 p-3 rounded text-sm overflow-auto mt-1 whitespace-pre-wrap">
          {xmlStr}
        </pre>
      );
    }

    if (viewMode === "html") {
      if (response.contentType.includes("html")) {
        return (
          <div
            className="bg-black/30 p-3 rounded text-sm overflow-auto mt-1 max-h-[400px] overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: response.rawText || String(response.body) }}
          />
        );
      } else {
        return (
          <pre className="bg-black/30 p-3 rounded text-sm overflow-auto mt-1 whitespace-pre-wrap">
            {response.rawText || String(response.body)}
          </pre>
        );
      }
    }

    return null;
  };

  const getCopyText = (): string => {
    if (!response) return "";
    if (response.rawText) return response.rawText;

    if (viewMode === "json") {
      if (typeof response.body === "object") {
        return JSON.stringify(response.body, null, 2);
      }
      return String(response.body);
    }

    if (viewMode === "xml") {
      if (typeof response.body === "object") {
        return formatXml(jsonToXml(response.body));
      }
      if (typeof response.rawText === "string") {
        return formatXml(response.rawText);
      }
      return String(response.body);
    }

    if (viewMode === "html") {
      return response.rawText || String(response.body);
    }

    return "";
  };

  const copyToClipboard = async () => {
    try {
      const text = getCopyText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      Sentry.captureException(err);
      alert("Failed to copy to clipboard");
    }
  };

  const CustomTooltip = (props: TooltipProps<number, string>) => {
    const { active, payload } = props as any;
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload as HistoryEntry;

      return (
        <div
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: 10,
            borderRadius: 6,
            maxWidth: 300,
            fontSize: 12,
            whiteSpace: "normal",
          }}
        >
          <div><strong>URL:</strong> {data.url}</div>
          <div><strong>Method:</strong> {data.method}</div>
          <div><strong>Duration:</strong> {data.durationMs} ms</div>
          <div><strong>Time:</strong> {new Date(data.timestamp).toLocaleTimeString()}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <main className="p-6 max-w-3xl mx-auto text-white">
      <div className="bg-zinc-900 p-6 rounded-2xl shadow-xl border border-zinc-700">
        <h1 className="text-3xl font-bold mb-6 text-blue-400">Zapman</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-1 font-semibold text-sm">Request URL</label>
            <input
              type="text"
              placeholder="https://api.example.com/endpoint"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full p-3 rounded-xl bg-zinc-800 border border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="block mb-1 font-semibold text-sm">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full p-3 rounded-xl bg-zinc-800 border border-zinc-600"
              >
                {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block mb-2 font-semibold text-sm">Headers</label>
            {headers.map((h, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input
                  type="text"
                  placeholder="Key"
                  className="flex-1 p-2 rounded-lg bg-zinc-800 border border-zinc-600"
                  value={h.key}
                  onChange={(e) => updateHeader(i, "key", e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Value"
                  className="flex-1 p-2 rounded-lg bg-zinc-800 border border-zinc-600"
                  value={h.value}
                  onChange={(e) => updateHeader(i, "value", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeHeaderField(i)}
                  className="text-red-400 text-xs hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addHeaderField}
              className="text-sm text-blue-400 hover:underline"
            >
              + Add Header
            </button>
          </div>

          {["POST", "PUT", "PATCH"].includes(method) && (
            <div>
              <label className="block mb-1 font-semibold text-sm">Body (JSON)</label>
              <textarea
                placeholder='{"key": "value"}'
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full p-3 rounded-xl bg-zinc-800 border border-zinc-600 h-40"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition duration-200"
          >
            {loading ? "Sending..." : "Send Request"}
          </button>
        </form>

        {response && (
          <div className="mt-8 p-4 bg-zinc-800 rounded-xl border border-zinc-700">
            <h2 className="text-xl font-semibold text-blue-300 mb-2">Response</h2>
            <p className="mb-1">
              Status: <span className="font-mono">{response.status} {response.statusText}</span>
            </p>
            <p className="mb-1">
              Time: <span className="font-mono">{response.durationMs}ms</span>
            </p>
            <p className="mb-3">
              Content-Type: <span className="font-mono">{response.contentType}</span>
            </p>
            
            {history.length > 0 && (
              <div className="mt-10">
                <h2 className="text-2xl font-bold mb-3 text-blue-400">Request Duration History (last 20)</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={history} barCategoryGap="20%" barGap={5}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                    dataKey="timestamp"
                    tickFormatter={(ts) =>
                      new Date(ts).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    }
                    />
                    <YAxis unit="ms" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                    dataKey="durationMs"
                    fill="#3b82f6"
                    maxBarSize={30}
                    isAnimationActive={true}
                    animationDuration={500}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="flex gap-3 mb-3">
              {["json", "xml", "html"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as "json" | "xml" | "html")}
                  className={`py-1 px-3 rounded-lg text-sm font-semibold transition ${
                    viewMode === mode
                      ? "bg-blue-400 text-black"
                      : "bg-zinc-700 hover:bg-zinc-600"
                  }`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
              <button
                onClick={copyToClipboard}
                className="ml-auto py-1 px-3 rounded-lg bg-green-500 hover:bg-green-600 text-black font-semibold text-sm"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className="overflow-auto max-h-96">{renderBody()}</div>
          </div>
        )}
      </div>
    </main>
  );
}