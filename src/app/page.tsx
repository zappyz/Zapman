'use client';

import { useState } from "react";
import { fetchAPI, ApiResponse } from "./utils/fetchAPI";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [headers, setHeaders] = useState([{ key: "", value: "" }]);
  const [viewMode, setViewMode] = useState<"json" | "xml" | "html">("json");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);

    const headersObj: Record<string, string> = {};
    headers.forEach(({ key, value }) => {
      if (key) headersObj[key] = value;
    });

    const isJson = headersObj['Content-Type'] === 'application/json';

    const res = await fetchAPI({
      url,
      method,
      headers: headersObj,
      body: isJson ? safeJsonParse(body) : body,
      includeRawText: true,
    });

    setResponse(res);
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

  // Convert JSON object to XML string
  const jsonToXml = (obj: any, indent = ""): string => {
    let xml = "";
    for (const prop in obj) {
      if (!obj.hasOwnProperty(prop)) continue;
      const value = obj[prop];
      if (typeof value === "object" && value !== null) {
        xml += `${indent}<${prop}>\n${jsonToXml(value, indent + "  ")}${indent}</${prop}>\n`;
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

    if (response.rawText) {
      return response.rawText;
    }

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
    } catch {
      alert("Failed to copy to clipboard");
    }
  };

  return (
    <main className="p-6 max-w-3xl mx-auto text-white">
      <div className="bg-zinc-900 p-6 rounded-2xl shadow-xl border border-zinc-700">
        <h1 className="text-3xl font-bold mb-6 text-blue-400">Mini Postman</h1>

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
              <div key={i} className="flex gap-2 mb-2">
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

            <h3 className="font-semibold mt-2 text-sm">Headers:</h3>
            <pre className="bg-black/30 p-3 rounded text-sm overflow-auto">
              {JSON.stringify(response.headers, null, 2)}
            </pre>

            <div className="flex gap-3 mt-4 items-center">
              <label className="font-semibold text-sm flex items-center gap-2">
                View as:
              </label>
              {["json", "xml", "html"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as "json" | "xml" | "html")}
                  className={`px-3 py-1 rounded ${
                    viewMode === mode
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                  }`}
                  type="button"
                >
                  {mode.toUpperCase()}
                </button>
              ))}

              <button
                onClick={copyToClipboard}
                type="button"
                className={`px-3 py-1 rounded ${
                  copied
                    ? "bg-green-600 text-white"
                    : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                }`}
              >
                {copied ? "Copied!" : "Copy Body"}
              </button>
            </div>

            <h3 className="font-semibold mt-4 text-sm">Body:</h3>
            {renderBody()}
          </div>
        )}

        {response?.error && (
          <p className="text-red-400 mt-4 font-mono">Error: {response.error}</p>
        )}
      </div>
    </main>
  );
}