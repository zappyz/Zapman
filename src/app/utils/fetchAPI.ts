import { json, text } from "stream/consumers";

export type ApiRequestOptions = {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
};

export type ApiResponse = {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
    contentType: string;
    durationMs: number;
    error?: string;
};

export async function fetchAPI(options: ApiRequestOptions): Promise<ApiResponse>{
    const { url, method, headers = {}, body } = options;
    const start = Date.now();

    try {
        const response = await fetch(url, {
            method,
            headers,
            body: ['POST', 'PUT', 'PATCH'].includes(method) ? body : undefined,
        });

        const contentType = response.headers.get("content-type") || "";
        const rawText = await response.text();
        const durationMs = Date.now() - start;

        let parsedBody: any;
        if (contentType.includes("application/json")) {
            try {
                parsedBody = JSON.parse(rawText);
            } catch {
                parsedBody = rawText
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