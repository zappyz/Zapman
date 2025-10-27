"use client";

import { useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { fetchAPI, ApiResponse } from "./utils/fetchAPI";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  TooltipProps,
} from "recharts";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [headers, setHeaders] = useState([{ key: "", value: "" }]);
  const [params, setParams] = useState([{ key: "", value: "" }]);
  const [viewMode, setViewMode] = useState<"json" | "xml" | "html">("json");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<
    {
      url: string;
      method: string;
      durationMs: number;
      timestamp: number;
      response: ApiResponse | null;
    }[]
  >([]);
  const [selectedHistory, setSelectedHistory] = useState<{
    url: string;
    method: string;
    durationMs: number;
    timestamp: number;
    response: ApiResponse | null;
  } | null>(null);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const safeJsonParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    setSelectedHistory(null);
    e.preventDefault();
    setLoading(true);
    setResponse(null);

    // Build headers
    const headersObj: Record<string, string> = {};
    headers.forEach(({ key, value }) => {
      if (key) headersObj[key] = value;
    });

    // Build query string
    const queryString = params
      .filter((p) => p.key)
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join("&");
    const finalUrl = queryString ? `${url}?${queryString}` : url;

    const isJson = headersObj["Content-Type"] === "application/json";

    try {
      const res = await fetchAPI({
        url: finalUrl,
        method,
        headers: headersObj,
        body: isJson ? safeJsonParse(body) : body,
        includeRawText: true,
      });

      setResponse(res);

      setHistory((prev) => [
        ...prev.slice(-19),
        {
          url: finalUrl,
          method,
          timestamp: Date.now(),
          durationMs: res.durationMs,
          response: res,
        },
      ]);

      Sentry.addBreadcrumb({
        category: "http",
        message: `Requested ${finalUrl} (${method})`,
        level: "info",
      });

      if (!res.ok) {
        Sentry.captureMessage(
          `Non-2xx response: ${res.status} from ${finalUrl}`,
        );
      }
    } catch (err) {
      Sentry.captureException(err);
      console.error("Fetch error:", err);
    }

    setLoading(false);
    setViewMode("json");
  };

  const updateHeader = (index: number, key: "key" | "value", value: string) => {
    const newHeaders = [...headers];
    newHeaders[index][key] = value;
    setHeaders(newHeaders);
  };

  const addHeaderField = () => setHeaders([...headers, { key: "", value: "" }]);
  const removeHeaderField = (index: number) =>
    setHeaders(headers.filter((_, i) => i !== index));

  const updateParam = (index: number, key: "key" | "value", value: string) => {
    const newParams = [...params];
    newParams[index][key] = value;
    setParams(newParams);
  };

  const addParamField = () => setParams([...params, { key: "", value: "" }]);
  const removeParamField = (index: number) =>
    setParams(params.filter((_, i) => i !== index));

  const jsonToXml = (obj: Record<string, unknown>, indent = ""): string => {
    let xml = "";
    for (const prop in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, prop)) continue;
      const value = obj[prop];
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        xml += `${indent}<${prop}>\n${jsonToXml(
          value as Record<string, unknown>,
          indent + "  ",
        )}${indent}</${prop}>\n`;
      } else {
        xml += `${indent}<${prop}>${value}</${prop}>\n`;
      }
    }
    return xml;
  };

  const formatXml = (xml: string) => xml.trim();

  const renderBody = (res: ApiResponse | null) => {
    if (!res) return null;

    if (viewMode === "json") {
      let jsonObj = res.body;
      if (typeof jsonObj === "string") {
        try {
          jsonObj = JSON.parse(jsonObj);
        } catch {}
      }
      return (
        <pre className="bg-black/30 p-3 rounded text-sm overflow-auto mt-1">
          {typeof jsonObj === "object"
            ? JSON.stringify(jsonObj, null, 2)
            : String(jsonObj)}
        </pre>
      );
    }

    if (viewMode === "xml") {
      let xmlStr = "";
      if (typeof res.body === "object") {
        xmlStr = formatXml(jsonToXml(res.body));
      } else if (typeof res.rawText === "string") {
        xmlStr = formatXml(res.rawText);
      } else {
        xmlStr = String(res.body);
      }
      return (
        <pre className="bg-black/30 p-3 rounded text-sm overflow-auto mt-1 whitespace-pre-wrap">
          {xmlStr}
        </pre>
      );
    }

    if (viewMode === "html") {
      if (res.contentType?.includes("html")) {
        return (
          <div
            className="bg-black/30 p-3 rounded text-sm overflow-auto mt-1 max-h-[400px] overflow-y-auto"
            dangerouslySetInnerHTML={{
              __html: res.rawText || String(res.body),
            }}
          />
        );
      } else {
        return (
          <pre className="bg-black/30 p-3 rounded text-sm overflow-auto mt-1 whitespace-pre-wrap">
            {res.rawText || String(res.body)}
          </pre>
        );
      }
    }

    return null;
  };

  const getCopyText = (res: ApiResponse | null): string => {
    if (!res) return "";
    if (res.rawText) return res.rawText;

    if (viewMode === "json") {
      if (typeof res.body === "object")
        return JSON.stringify(res.body, null, 2);
      return String(res.body);
    }

    if (viewMode === "xml") {
      if (typeof res.body === "object") return formatXml(jsonToXml(res.body));
      if (typeof res.rawText === "string") return formatXml(res.rawText);
      return String(res.body);
    }

    if (viewMode === "html") return res.rawText || String(res.body);

    return "";
  };

  const copyToClipboard = async () => {
    try {
      const text = getCopyText(selectedHistory?.response ?? response);
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
      const data = payload[0].payload as (typeof history)[0];
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
          <div>
            <strong>URL:</strong> {data.url}
          </div>
          <div>
            <strong>Method:</strong> {data.method}
          </div>
          <div>
            <strong>Duration:</strong> {data.durationMs} ms
          </div>
          <div>
            <strong>Time:</strong>{" "}
            {new Date(data.timestamp).toLocaleTimeString()}
          </div>
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
          {/* URL */}
          <div>
            <label className="block mb-1 font-semibold text-sm">
              Request URL
            </label>
            <input
              type="text"
              placeholder="https://api.example.com/endpoint"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full p-3 rounded-xl bg-zinc-800 border border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Method */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="block mb-1 font-semibold text-sm">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full p-3 rounded-xl bg-zinc-800 border border-zinc-600"
              >
                {["GET", "POST", "PUT", "DELETE", "PATCH"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Query Params */}
          <div>
            <label className="block mb-2 font-semibold text-sm">
              Query Params
            </label>
            {params.map((p, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input
                  type="text"
                  placeholder="Key"
                  className="flex-1 p-2 rounded-lg bg-zinc-800 border border-zinc-600"
                  value={p.key}
                  onChange={(e) => updateParam(i, "key", e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Value"
                  className="flex-1 p-2 rounded-lg bg-zinc-800 border border-zinc-600"
                  value={p.value}
                  onChange={(e) => updateParam(i, "value", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeParamField(i)}
                  className="text-red-400 text-xs hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addParamField}
              className="text-sm text-blue-400 hover:underline"
            >
              + Add Param
            </button>
          </div>

          {/* Headers */}
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

          {/* Body */}
          {["POST", "PUT", "PATCH"].includes(method) && (
            <div>
              <label className="block mb-1 font-semibold text-sm">
                Body (JSON)
              </label>
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

        {/* Response and history */}
        {(response || selectedHistory) && (
          <div className="mt-8 p-4 bg-zinc-800 rounded-xl border border-zinc-700">
            <h2 className="text-xl font-semibold text-blue-300 mb-2">
              Response
            </h2>
            <p className="mb-1">
              Status:{" "}
              <span className="font-mono">
                {selectedHistory?.response?.status ?? response?.status}{" "}
                {selectedHistory?.response?.statusText ?? response?.statusText}
              </span>
            </p>
            <p className="mb-1">
              Time:{" "}
              <span className="font-mono">
                {selectedHistory?.response?.durationMs ?? response?.durationMs}
                ms
              </span>
            </p>
            <p className="mb-3">
              Content-Type:{" "}
              <span className="font-mono">
                {selectedHistory?.response?.contentType ??
                  response?.contentType}
              </span>
            </p>

            {history.length > 0 && (
              <div className="mt-10">
                <h2 className="text-2xl font-bold mb-3 text-blue-400">
                  Request Duration History (last 20)
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={history} barCategoryGap="20%" barGap={5}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                    />
                    <YAxis unit="ms" />
                    <Tooltip content={<CustomTooltip />} cursor={false} />
                    <Bar
                      dataKey="durationMs"
                      maxBarSize={30}
                      onMouseLeave={() => setActiveIndex(null)}
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onClick={(_, index) => {
                        const entry = history[index];
                        if (entry) setSelectedHistory(entry);
                      }}
                    >
                      {history.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={index === activeIndex ? "#2563eb" : "#3b82f6"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="flex gap-3 mb-3 mt-3">
              {["json", "xml", "html"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as "json" | "xml" | "html")}
                  className={`px-3 py-1 rounded ${viewMode === mode ? "bg-blue-600 text-white" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"}`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
              <button
                onClick={copyToClipboard}
                className="ml-auto bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-white"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => {
                  setUrl("");
                  setMethod("GET");
                  setBody("");
                  setHeaders([{ key: "", value: "" }]);
                  setParams([{ key: "", value: "" }]);
                  setActiveIndex(null);
                  setViewMode("json");
                  setCopied(false);
                }}
                className="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded text-white"
              >
                Reset Fields
              </button>

              <button
                onClick={() => {
                  setHistory([]);
                  setSelectedHistory(null);
                  setUrl("");
                  setMethod("GET");
                  setBody("");
                  setHeaders([{ key: "", value: "" }]);
                  setParams([{ key: "", value: "" }]);
                  setResponse(null);
                  setActiveIndex(null);
                  setViewMode("json");
                }}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-white"
              >
                Clear History
              </button>
            </div>
            <div className="max-h-[300px] overflow-auto">
              {renderBody(selectedHistory?.response ?? response)}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
