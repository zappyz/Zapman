export type ApiRequestOptions = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string | object;
  includeRawText?: boolean;
  responseFormat?: "json" | "xml" | "html";
};

export type ApiResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  contentType: string;
  durationMs: number;
  error?: string;
  rawText?: string;
};

export async function fetchAPI(options: ApiRequestOptions): Promise<ApiResponse> {
  const { url, method, headers = {}, body, includeRawText = false, responseFormat } = options;
  const start = Date.now();

  try {
    let requestBody: string | undefined = undefined;

    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      if (typeof body === 'object') {
        requestBody = JSON.stringify(body);
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      } else {
        requestBody = body as string;
      }
    }

    const response = await fetch(url, {
      method,
      headers,
      body: requestBody,
    });

    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();
    const durationMs = Date.now() - start;

    let parsedBody: any;

    const format = responseFormat?.toLowerCase() || "";

    if (format === "json" || (!format && contentType.includes("application/json"))) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = rawText;
      }
    } else if (
      format === "xml" ||
      (!format && (contentType.includes("application/xml") || contentType.includes("text/xml") || contentType.includes("application/xhtml+xml")))
    ) {
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        parsedBody = parser.parseFromString(rawText, "application/xml");
      } else {
        parsedBody = rawText;
      }
    } else if (
      format === "html" ||
      (!format && contentType.includes("text/html"))
    ) {
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        parsedBody = parser.parseFromString(rawText, "text/html");
      } else {
        parsedBody = rawText;
      }
    } else {
      parsedBody = rawText;
    }

    const headersObj: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      contentType,
      headers: headersObj,
      body: parsedBody,
      durationMs,
      ...(includeRawText ? { rawText } : {})
    };
  } catch (error: any) {
    return {
      status: 0,
      statusText: "Network error",
      contentType: "",
      headers: {},
      body: null,
      durationMs: Date.now() - start,
      error: error.message,
    };
  }
}