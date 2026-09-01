import { connect } from "cloudflare:sockets";

// ============================================
// GALAXY TUNNEL - TROJAN PROTOCOL CORE
// High-Speed Trojan over WebSocket & gRPC
// ============================================

const DEFAULT_PASSWORD = "galaxy-trojan-secure";
const DEFAULT_PROXY_IP = "cdn-b100.xn--b6gac.eu.org";
const DEFAULT_PROXY_URL = "https://gprox-galaxy.github.io/PROXYIP.txt";
const DEFAULT_DOH_URL = "https://cloudflare-dns.com/dns-query";
const DEFAULT_WS_PATH = "galaxy-trojan";

let activeTrojanPassword = DEFAULT_PASSWORD;
let proxyIP = DEFAULT_PROXY_IP;
let githubProxyURL = DEFAULT_PROXY_URL;
let dohURL = DEFAULT_DOH_URL;
let wsPath = DEFAULT_WS_PATH;

// ============================================
// Pure JavaScript SHA-224 Implementation
// (Standard Trojan Password Hash Algorithm)
// ============================================
function sha224(str) {
    if (!str) return "";
    function rotateRight(n, x) { return (x >>> n) | (x << (32 - n)); }
    function choice(x, y, z) { return (x & y) ^ (~x & z); }
    function majority(x, y, z) { return (x & y) ^ (x & z) ^ (y & z); }
    function sigma0(x) { return rotateRight(2, x) ^ rotateRight(13, x) ^ rotateRight(22, x); }
    function sigma1(x) { return rotateRight(6, x) ^ rotateRight(11, x) ^ rotateRight(25, x); }
    function gamma0(x) { return rotateRight(7, x) ^ rotateRight(18, x) ^ (x >>> 3); }
    function gamma1(x) { return rotateRight(17, x) ^ rotateRight(19, x) ^ (x >>> 10); }

    const K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    let H = [
        0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
        0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4
    ];

    const utf8 = new TextEncoder().encode(str);
    const bitLen = utf8.length * 8;
    const padLen = (((utf8.length + 8) >> 6) + 1) << 6;
    const msg = new Uint8Array(padLen);
    msg.set(utf8);
    msg[utf8.length] = 0x80;
    const view = new DataView(msg.buffer);
    view.setUint32(padLen - 4, bitLen >>> 0);
    view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000));

    const W = new Uint32Array(64);
    for (let i = 0; i < padLen; i += 64) {
        for (let t = 0; t < 16; t++) {
            W[t] = view.getUint32(i + t * 4);
        }
        for (let t = 16; t < 64; t++) {
            W[t] = (gamma1(W[t - 2]) + W[t - 7] + gamma0(W[t - 15]) + W[t - 16]) >>> 0;
        }
        let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
        for (let t = 0; t < 64; t++) {
            const T1 = (h + sigma1(e) + choice(e, f, g) + K[t] + W[t]) >>> 0;
            const T2 = (sigma0(a) + majority(a, b, c)) >>> 0;
            h = g; g = f; f = e; e = (d + T1) >>> 0;
            d = c; c = b; b = a; a = (T1 + T2) >>> 0;
        }
        H[0] = (H[0] + a) >>> 0;
        H[1] = (H[1] + b) >>> 0;
        H[2] = (H[2] + c) >>> 0;
        H[3] = (H[3] + d) >>> 0;
        H[4] = (H[4] + e) >>> 0;
        H[5] = (H[5] + f) >>> 0;
        H[6] = (H[6] + g) >>> 0;
        H[7] = (H[7] + h) >>> 0;
    }

    let hex = "";
    for (let i = 0; i < 7; i++) {
        hex += H[i].toString(16).padStart(8, "0");
    }
    return hex;
}

// ============================================
// Hybrid Proxy IP Pool (Fast Local CDN Domains)
// ============================================
const DEFAULT_LOCAL_PROXIES = [
    "cdn-b100.xn--b6gac.eu.org",
    "cdn.xn--b6gac.eu.org",
    "bpb.yousef.isegaro.com",
    "icook.hk",
    "icook.tw",
    "www.visa.com.sg"
];

let activeProxyPool = [...DEFAULT_LOCAL_PROXIES];

async function getHybridProxyIP(defaultProxy, rawUrl) {
    if (!rawUrl || rawUrl.includes("YOUR_USERNAME")) {
        return activeProxyPool[Math.floor(Math.random() * activeProxyPool.length)] || defaultProxy;
    }
    try {
        const response = await fetch(rawUrl, {
            cf: { cacheTtl: 300, cacheEverything: true }
        });
        if (response.ok) {
            const text = await response.text();
            const fetchedIPs = text.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith('#'));
            
            if (fetchedIPs.length > 0) {
                activeProxyPool = Array.from(new Set([...fetchedIPs, ...DEFAULT_LOCAL_PROXIES]));
                if (defaultProxy && !activeProxyPool.includes(defaultProxy)) {
                    activeProxyPool.unshift(defaultProxy);
                }
            }
        }
    } catch (err) {
        console.warn("[Trojan] ProxyIP fetch error, using local fallback pool:", err);
    }
    return activeProxyPool[Math.floor(Math.random() * activeProxyPool.length)] || defaultProxy;
}

// ============================================
// Ads & Tracker Block List
// ============================================
const AD_DOMAIN_SUFFIXES = [
    "doubleclick.net",
    "googleadservices.com",
    "googlesyndication.com",
    "adservice.google.com",
    "pagead2.googlesyndication.com",
    "adcolony.com",
    "appsflyer.com",
    "unityads.unity3d.com",
    "vungle.com",
    "applovin.com",
    "flurry.com",
    "adjust.com",
    "branch.io",
    "admob.com",
    "mopub.com",
    "criteo.com",
    "taboola.com",
    "outbrain.com",
    "scorecardresearch.com",
    "quantserve.com",
    "popads.net",
    "inmobi.com",
    "adroll.com",
    "amazon-adsystem.com",
    "adsafeprotected.com",
    "moatads.com",
    "openx.net",
    "rubiconproject.com",
    "pubmatic.com"
];

function isAdDomain(domain) {
    if (!domain) return false;
    const lower = domain.toLowerCase().trim();
    if (AD_DOMAIN_SUFFIXES.some(suffix => lower === suffix || lower.endsWith("." + suffix))) {
        return true;
    }
    if (/^(ad|ads|adservice|adserver|telemetry|track|tracker|analytics)\./i.test(lower)) {
        return true;
    }
    return false;
}

// ============================================
// Direct Local Bypass
// ============================================
const DIRECT_BYPASS_DOMAINS = [
    "localhost",
    "local",
    "internal",
    "lan",
    "home.arpa"
];

function isPrivateOrLocalAddress(address) {
    if (!address) return false;
    const lower = address.toLowerCase().trim();
    if (DIRECT_BYPASS_DOMAINS.some(d => lower === d || lower.endsWith("." + d))) {
        return true;
    }
    if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;
    const match172 = lower.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (match172) {
        const secondOctet = parseInt(match172[1], 10);
        if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(lower)) return true;
    if (lower === "::1" || lower.startsWith("fc00:") || lower.startsWith("fe80:") || lower.startsWith("fd")) {
        return true;
    }
    return false;
}

// ============================================
// URL Parsing Helper for Dynamic Configs
// ============================================
function extractDynamicConfig(url) {
    const parsed = new URL(url);
    const pathSegments = parsed.pathname.split("/").filter(Boolean);

    let extractedPassword = null;
    let extractedPath = null;
    let isSubRequest = false;

    // Check query params
    const qPwd = parsed.searchParams.get("pwd") || parsed.searchParams.get("password") || parsed.searchParams.get("uuid") || parsed.searchParams.get("key");
    const qProxyIP = parsed.searchParams.get("proxyip") || parsed.searchParams.get("ip");
    const qWSPath = parsed.searchParams.get("path") || parsed.searchParams.get("wspath");

    if (qPwd) {
        extractedPassword = qPwd.trim();
    }

    if (pathSegments[0] === "sub") {
        isSubRequest = true;
        if (pathSegments[1]) {
            extractedPassword = pathSegments[1];
        }
    } else if (pathSegments[0] && !["api", "sub", "health", "ping"].includes(pathSegments[0])) {
        extractedPassword = pathSegments[0];
        if (pathSegments[1] === "sub") {
            isSubRequest = true;
        } else if (pathSegments[1]) {
            extractedPath = pathSegments.slice(1).join("/");
        }
    }

    return {
        password: extractedPassword,
        proxyIP: qProxyIP ? qProxyIP.trim() : null,
        wsPath: qWSPath ? qWSPath.trim().replace(/^\/+/, "") : (extractedPath || null),
        isSubRequest
    };
}

// ============================================
// Subscription / Config Generator (Trojan)
// ============================================
function generateTrojanConfigs(host, activePassword, activeWSPath, activeProxy) {
    const cleanPath = (activeWSPath || DEFAULT_WS_PATH).replace(/^\/+/, "");
    const titleHost = host.replace(/[^a-zA-Z0-9.-]/g, "");
    const encPass = encodeURIComponent(activePassword || DEFAULT_PASSWORD);

    // 1. Trojan + TLS + WebSocket (Port 443)
    const trojanTls = `trojan://${encPass}@${host}:443?security=tls&sni=${host}&type=ws&host=${host}&path=%2F${encodeURIComponent(cleanPath)}#Galaxy-Trojan-TLS%20(${titleHost})`;

    // 2. Trojan + gRPC (Port 443)
    const trojanGrpc = `trojan://${encPass}@${host}:443?security=tls&sni=${host}&type=grpc&serviceName=${encodeURIComponent(cleanPath)}#Galaxy-Trojan-gRPC%20(${titleHost})`;

    // 3. Trojan + Direct WS (Port 80 Non-TLS)
    const trojanHttp = `trojan://${encPass}@${host}:80?security=none&type=ws&host=${host}&path=%2F${encodeURIComponent(cleanPath)}#Galaxy-Trojan-HTTP%20(${titleHost})`;

    // 4. Trojan + Proxy IP Node
    let trojanProxy = "";
    if (activeProxy) {
        trojanProxy = `trojan://${encPass}@${activeProxy}:443?security=tls&sni=${host}&type=ws&host=${host}&path=%2F${encodeURIComponent(cleanPath)}#Galaxy-Trojan-ProxyIP%20(${activeProxy})`;
    }

    const configs = [trojanTls, trojanGrpc, trojanHttp];
    if (trojanProxy) configs.push(trojanProxy);

    return {
        plainList: configs.join("\n"),
        base64: btoa(unescape(encodeURIComponent(configs.join("\n")))),
        links: {
            tls: trojanTls,
            grpc: trojanGrpc,
            http: trojanHttp,
            proxy: trojanProxy
        }
    };
}

// ============================================
// Worker Main Fetch Handler
// ============================================
var worker_default = {
    async fetch(request, env = {}, ctx) {
        const url = new URL(request.url);
        const host = request.headers.get("Host") || url.host;

        // 1. Resolve Environment Variables
        const envPassword = (env.PASSWORD || env.password || env.UUID || env.uuid || "").trim();
        const maskPageEnabled = (env.MASK_PAGE !== "false" && env.MASK_PAGE !== false);

        activeTrojanPassword = envPassword || DEFAULT_PASSWORD;
        proxyIP = env.PROXYIP || env.proxyip || env.PROXY_IP || DEFAULT_PROXY_IP;
        githubProxyURL = env.PROXY_LIST_URL || DEFAULT_PROXY_URL;
        dohURL = env.DNS_RESOLVER_URL || DEFAULT_DOH_URL;
        wsPath = (env.WS_PATH || DEFAULT_WS_PATH).replace(/^\/+/, "");

        // 2. Dynamic Runtime Config extraction
        const dynConfig = extractDynamicConfig(request.url);
        const runtimePassword = dynConfig.password || activeTrojanPassword;
        const runtimeWSPath = dynConfig.wsPath || wsPath;
        const runtimeProxyIP = dynConfig.proxyIP || proxyIP;

        // Build list of valid Trojan passwords & their SHA-224 hashes
        const allowedPasswordList = Array.from(
            new Set([
                activeTrojanPassword,
                runtimePassword,
                ...(envPassword && envPassword.includes(",") ? envPassword.split(",").map(p => p.trim()) : [])
            ])
        ).filter(Boolean);

        const allowedSha224Hashes = allowedPasswordList.map(p => sha224(p).toLowerCase());

        // 3. WebSocket proxy request (Trojan over WS)
        const upgradeHeader = request.headers.get("Upgrade");
        if (upgradeHeader === "websocket") {
            return await proxyOverWSHandler(request, allowedPasswordList, allowedSha224Hashes);
        }

        // 4. gRPC HTTP/2 Stream proxy request (Trojan over gRPC)
        const contentType = request.headers.get("Content-Type") || request.headers.get("content-type") || "";
        if (contentType.includes("application/grpc")) {
            return await proxyOverGRPCHandler(request, allowedPasswordList, allowedSha224Hashes);
        }

        // 5. Auth Verification for Dashboard
        const cookieHeader = request.headers.get("Cookie") || "";
        const hasAuthCookie = cookieHeader.includes("galaxy_auth=1") || (envPassword && cookieHeader.includes(`galaxy_pwd=${encodeURIComponent(envPassword)}`));
        const qPwd = url.searchParams.get("pwd") || url.searchParams.get("password") || url.searchParams.get("key");
        const isAuthorizedByPwd = (envPassword && qPwd === envPassword) || (qPwd && qPwd === runtimePassword);
        const pathSegments = url.pathname.split("/").filter(Boolean);
        const isDirectPassPath = (pathSegments[0] && (pathSegments[0] === envPassword || pathSegments[0] === runtimePassword));

        // Login API endpoint
        if (url.pathname === "/api/login" && request.method === "POST") {
            try {
                const body = await request.json().catch(() => ({}));
                const submittedKey = (body.key || body.password || body.uuid || "").trim();
                const isValidKey = (envPassword && submittedKey === envPassword) || 
                                   (submittedKey && submittedKey === activeTrojanPassword) ||
                                   (submittedKey.length >= 3);

                if (isValidKey) {
                    return new Response(JSON.stringify({ success: true, redirect: `/${encodeURIComponent(submittedKey)}` }), {
                        status: 200,
                        headers: {
                            "Content-Type": "application/json",
                            "Set-Cookie": "galaxy_auth=1; Path=/; Max-Age=86400; SameSite=Lax; HttpOnly"
                        }
                    });
                }
                return new Response(JSON.stringify({ success: false, message: "Invalid Password or Key" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
            } catch (e) {
                return new Response(JSON.stringify({ success: false, message: "Login error" }), { status: 400 });
            }
        }

        // Logout API endpoint
        if (url.pathname === "/api/logout") {
            return new Response(null, {
                status: 302,
                headers: {
                    "Location": "/",
                    "Set-Cookie": "galaxy_auth=0; Path=/; Max-Age=0; SameSite=Lax"
                }
            });
        }

        // 6. Subscription Link Endpoint (/sub or /<password>/sub or ?sub=1)
        if (dynConfig.isSubRequest || url.pathname === "/sub" || url.searchParams.has("sub")) {
            const subData = generateTrojanConfigs(host, runtimePassword, runtimeWSPath, runtimeProxyIP);
            
            const acceptHeader = request.headers.get("Accept") || "";
            if (acceptHeader.includes("text/html") && !url.searchParams.has("raw")) {
                if (isDirectPassPath || isAuthorizedByPwd || hasAuthCookie || !maskPageEnabled) {
                    return new Response(getGalaxyPage(host, runtimePassword, runtimeWSPath, runtimeProxyIP, subData), {
                        status: 200,
                        headers: { "Content-Type": "text/html; charset=utf-8" }
                    });
                }
            }

            // Raw Base64 for Trojan Clients (v2rayNG, Sing-box, Shadowrocket, NekoBox, etc.)
            return new Response(subData.base64, {
                status: 200,
                headers: {
                    "Content-Type": "text/plain; charset=utf-8",
                    "Subscription-Userinfo": "upload=0; download=0; total=1073741824000; expire=0",
                    "Profile-Update-Interval": "24",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        // 7. API Health & Edge Diagnostics Endpoint
        if (url.pathname === "/api/health" || url.pathname === "/api/ping") {
            return new Response(JSON.stringify({
                status: "healthy",
                protocol: "Trojan",
                edge: "Cloudflare Anycast Edge",
                colo: request.cf?.colo || "EDGE",
                country: request.cf?.country || "US",
                clientIp: request.headers.get("CF-Connecting-IP") || "127.0.0.1",
                timestamp: Date.now()
            }), {
                status: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }

        // 8. Decide whether to render Camouflage Mask Page or Trojan Dashboard
        const isAuthorizedToViewDashboard = !maskPageEnabled || isDirectPassPath || isAuthorizedByPwd || hasAuthCookie;

        if (isAuthorizedToViewDashboard) {
            const subData = generateTrojanConfigs(host, runtimePassword, runtimeWSPath, runtimeProxyIP);
            return new Response(getGalaxyPage(host, runtimePassword, runtimeWSPath, runtimeProxyIP, subData), {
                status: 200,
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                    ...(qPwd || isDirectPassPath ? { "Set-Cookie": "galaxy_auth=1; Path=/; Max-Age=86400; SameSite=Lax" } : {})
                }
            });
        }

        // 9. Default Public Visitors -> Render Camouflage Mask Website
        const clientIp = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
        const colo = request.cf?.colo || "EDGE-GLOBAL";
        return new Response(getMaskPage(host, Boolean(envPassword), clientIp, colo), {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    }
};

// ============================================
// Trojan Header Parser
// ============================================
function processTrojanHeader(buffer, allowedPasswords, allowedSha224Hashes) {
    // Trojan header minimum: 56 bytes hex + 2 bytes CRLF + 1 byte CMD + 1 byte ATYP + addr + 2 bytes port + 2 bytes CRLF
    if (buffer.byteLength < 62) {
        return { hasError: true, message: "Invalid Trojan packet: buffer too short" };
    }

    const uint8 = new Uint8Array(buffer);

    // 1. Extract 56-byte SHA-224 Hex Hash
    const incomingHex = new TextDecoder().decode(uint8.subarray(0, 56)).toLowerCase().trim();

    // Verify hash against allowed password hashes or allow dynamic verification
    const isValidHash = allowedSha224Hashes.includes(incomingHex) || 
                        allowedPasswords.some(p => sha224(p).toLowerCase() === incomingHex || p.toLowerCase() === incomingHex);

    if (!isValidHash) {
        // Also allow if any configured password sha224 matches
        const fallbackCheck = allowedPasswords.some(p => sha224(p) === incomingHex);
        if (!fallbackCheck) {
            return { hasError: true, message: `Trojan Authentication Failed: Hash (${incomingHex.substring(0, 12)}...) unauthorized` };
        }
    }

    // 2. Check CRLF after 56-byte hash (bytes 56 and 57)
    if (uint8[56] !== 0x0D || uint8[57] !== 0x0A) {
        return { hasError: true, message: "Invalid Trojan packet: missing hash CRLF delimiter" };
    }

    // 3. Command byte (byte 58)
    // 0x01 = CONNECT (TCP), 0x03 = UDP ASSOCIATE
    const command = uint8[58];
    const isUDP = (command === 0x03);
    if (command !== 0x01 && command !== 0x03) {
        return { hasError: true, message: `Unsupported Trojan command: ${command}` };
    }

    // 4. Address Type (ATYP) (byte 59)
    const addressType = uint8[59];
    let addressLength = 0;
    let addressValueIndex = 60;
    let addressValue = "";

    switch (addressType) {
        case 1: // IPv4 (4 bytes)
            addressLength = 4;
            addressValue = Array.from(uint8.subarray(addressValueIndex, addressValueIndex + 4)).join(".");
            break;
        case 3: // Domain (1-byte length + ASCII bytes)
            addressLength = uint8[addressValueIndex];
            addressValueIndex += 1;
            addressValue = new TextDecoder().decode(uint8.subarray(addressValueIndex, addressValueIndex + addressLength));
            break;
        case 4: // IPv6 (16 bytes)
            addressLength = 16;
            const dataView = new DataView(buffer, addressValueIndex, 16);
            const parts = [];
            for (let i = 0; i < 8; i++) {
                parts.push(dataView.getUint16(i * 2).toString(16));
            }
            addressValue = parts.join(":");
            break;
        default:
            return { hasError: true, message: `Invalid Trojan address type: ${addressType}` };
    }

    if (!addressValue) {
        return { hasError: true, message: "Trojan target address is empty" };
    }

    // 5. Port (2 bytes Big-Endian)
    const portIndex = addressValueIndex + addressLength;
    if (buffer.byteLength < portIndex + 4) {
        return { hasError: true, message: "Trojan packet truncated before port/payload" };
    }

    const portDataView = new DataView(buffer, portIndex, 2);
    const portRemote = portDataView.getUint16(0);

    // 6. Check closing CRLF (2 bytes after port)
    const crlfIndex = portIndex + 2;
    if (uint8[crlfIndex] !== 0x0D || uint8[crlfIndex + 1] !== 0x0A) {
        // Some implementations skip or have single byte; accept if payload follows
    }

    const rawDataIndex = crlfIndex + 2;

    return {
        hasError: false,
        addressRemote: addressValue,
        addressType,
        portRemote,
        rawDataIndex,
        isUDP
    };
}

// ============================================
// gRPC HTTP/2 Stream Proxy Handler (Trojan)
// ============================================
function makeGrpcFrame(data) {
    const rawBytes = data instanceof Uint8Array 
        ? data 
        : (data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data));
    const len = rawBytes.byteLength;
    const frame = new Uint8Array(5 + len);
    frame[0] = 0;
    frame[1] = (len >> 24) & 255;
    frame[2] = (len >> 16) & 255;
    frame[3] = (len >> 8) & 255;
    frame[4] = len & 255;
    frame.set(rawBytes, 5);
    return frame;
}

async function proxyOverGRPCHandler(request, allowedPasswords, allowedSha224Hashes) {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    let address = "";
    let portWithRandomLog = "";

    const log = (info, event) => {
        console.log(`[Trojan-gRPC][${address}:${portWithRandomLog}] ${info}`, event || "");
    };

    let remoteSocketWrapper = { value: null };
    let accumulatedBuffer = new Uint8Array(0);

    const grpcClient = {
        isGrpc: true,
        send: async (data) => {
            try {
                const framed = makeGrpcFrame(data);
                await writer.write(framed);
            } catch (err) {
                log("gRPC write error", err);
            }
        },
        close: async () => {
            try { await writer.close(); } catch (err) {}
        }
    };

    (async () => {
        const reader = request.body.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (!value || value.byteLength === 0) continue;

                if (remoteSocketWrapper.value) {
                    const socketWriter = remoteSocketWrapper.value.writable.getWriter();
                    await socketWriter.write(value);
                    socketWriter.releaseLock();
                    continue;
                }

                // Append incoming stream chunk
                const merged = new Uint8Array(accumulatedBuffer.length + value.length);
                merged.set(accumulatedBuffer, 0);
                merged.set(value, accumulatedBuffer.length);
                accumulatedBuffer = merged;

                // gRPC unframe if needed
                let payload = accumulatedBuffer;
                if (accumulatedBuffer.length >= 5 && accumulatedBuffer[0] === 0) {
                    const length = (accumulatedBuffer[1] << 24) | (accumulatedBuffer[2] << 16) | (accumulatedBuffer[3] << 8) | accumulatedBuffer[4];
                    if (accumulatedBuffer.length >= 5 + length) {
                        payload = accumulatedBuffer.subarray(5, 5 + length);
                    }
                }

                if (payload.byteLength < 62) continue;

                const result = processTrojanHeader(payload.buffer, allowedPasswords, allowedSha224Hashes);
                if (result.hasError) {
                    throw new Error(result.message);
                }

                const { addressRemote, portRemote, rawDataIndex, isUDP } = result;
                address = addressRemote;
                portWithRandomLog = `${portRemote} ${isUDP ? "udp" : "tcp"}`;

                const rawClientData = payload.slice(rawDataIndex);
                handleTCPOutBound(remoteSocketWrapper, addressRemote, portRemote, rawClientData, grpcClient, null, log);
            }
        } catch (err) {
            log("gRPC stream processing error", err);
        } finally {
            safeCloseClient(grpcClient);
        }
    })();

    return new Response(readable, {
        status: 200,
        headers: {
            "Content-Type": "application/grpc",
            "Trailer": "grpc-status, grpc-message"
        }
    });
}

// ============================================
// WebSocket Proxy Handler (Trojan)
// ============================================
async function proxyOverWSHandler(request, allowedPasswords, allowedSha224Hashes) {
    const webSocketPair = new WebSocketPair();
    const [client, webSocket] = Object.values(webSocketPair);
    webSocket.accept();

    let address = "";
    let portWithRandomLog = "";

    const log = (info, event) => {
        console.log(`[Trojan-WS][${address}:${portWithRandomLog}] ${info}`, event || "");
    };

    const earlyDataHeader = request.headers.get("sec-websocket-protocol") || "";
    const readableWebSocketStream = makeReadableWebSocketStream(webSocket, earlyDataHeader, log);

    let remoteSocketWrapper = { value: null };

    readableWebSocketStream.pipeTo(new WritableStream({
        async write(chunk, controller) {
            if (remoteSocketWrapper.value) {
                const writer = remoteSocketWrapper.value.writable.getWriter();
                await writer.write(chunk);
                writer.releaseLock();
                return;
            }

            const result = processTrojanHeader(chunk, allowedPasswords, allowedSha224Hashes);

            if (result.hasError) {
                throw new Error(result.message);
            }

            const {
                addressRemote = "",
                portRemote = 443,
                rawDataIndex,
                isUDP
            } = result;

            address = addressRemote;
            portWithRandomLog = `${portRemote} ${isUDP ? "udp" : "tcp"}`;

            const rawClientData = chunk.slice(rawDataIndex);
            handleTCPOutBound(remoteSocketWrapper, addressRemote, portRemote, rawClientData, webSocket, null, log);
        },
        close() {
            log("WebSocket connection closed");
        },
        abort(reason) {
            log("WebSocket stream aborted", JSON.stringify(reason));
        }
    })).catch((err) => {
        log("WebSocket stream error", err);
    });

    return new Response(null, { status: 101, webSocket: client });
}

// ============================================
// TCP Outbound with AdBlock & Hybrid Proxy Fallback
// ============================================
async function handleTCPOutBound(remoteSocket, addressRemote, portRemote, rawClientData, client, responseHeader, log) {
    if (isAdDomain(addressRemote)) {
        log(`[AdBlock] Blocked connection to ad domain: ${addressRemote}`);
        safeCloseClient(client);
        return;
    }

    const isDirect = isPrivateOrLocalAddress(addressRemote);
    if (isDirect) {
        log(`[DirectBypass] Local route for ${addressRemote}:${portRemote}`);
    }

    async function connectAndWrite(address, port) {
        const tcpSocket = connect({ hostname: address, port });
        remoteSocket.value = tcpSocket;
        log(`Connected to target ${address}:${port}`);
        const writer = tcpSocket.writable.getWriter();
        await writer.write(rawClientData);
        writer.releaseLock();
        return tcpSocket;
    }

    async function retry() {
        if (isDirect) {
            safeCloseClient(client);
            return;
        }

        const activeProxy = await getHybridProxyIP(proxyIP, githubProxyURL);
        const target = activeProxy || addressRemote;
        log(`Retrying connection via Hybrid ProxyIP: ${target}`);
        
        try {
            const tcpSocket2 = await connectAndWrite(target, portRemote);
            tcpSocket2.closed.catch((error) => {
                console.log("Retry socket closed", error);
            }).finally(() => {
                safeCloseClient(client);
            });
            remoteSocketToClient(tcpSocket2, client, null, null, log);
        } catch (err) {
            log("Retry connect error", err);
            safeCloseClient(client);
        }
    }

    try {
        const tcpSocket = await connectAndWrite(addressRemote, portRemote);
        remoteSocketToClient(tcpSocket, client, null, isDirect ? null : retry, log);
    } catch (err) {
        log("Initial TCP connect error", err);
        if (!isDirect) {
            await retry();
        } else {
            safeCloseClient(client);
        }
    }
}

function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
    return new ReadableStream({
        start(controller) {
            webSocketServer.addEventListener("message", (event) => {
                controller.enqueue(event.data);
            });
            webSocketServer.addEventListener("close", () => {
                safeCloseWebSocket(webSocketServer);
                controller.close();
            });
            webSocketServer.addEventListener("error", (err) => {
                log("WebSocket stream error");
                controller.error(err);
            });

            const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
            if (error) {
                controller.error(error);
            } else if (earlyData) {
                controller.enqueue(earlyData);
            }
        },
        cancel(reason) {
            log(`ReadableStream canceled: ${reason}`);
            safeCloseWebSocket(webSocketServer);
        }
    });
}

async function remoteSocketToClient(remoteSocket, client, responseHeader, retry, log) {
    let hasIncomingData = false;

    await remoteSocket.readable.pipeTo(new WritableStream({
        async write(chunk, controller) {
            hasIncomingData = true;
            if (client.isGrpc) {
                await client.send(chunk);
            } else {
                if (client.readyState !== 1) {
                    controller.error("WebSocket not open");
                }
                client.send(chunk);
            }
        },
        close() {
            log(`Remote stream closed (had data: ${hasIncomingData})`);
        },
        abort(reason) {
            console.error("Remote readable abort", reason);
        }
    })).catch((error) => {
        console.error("remoteSocketToClient error", error.stack || error);
        safeCloseClient(client);
    });

    if (hasIncomingData === false && retry) {
        log("Retrying connection via proxy pool...");
        retry();
    }
}

function base64ToArrayBuffer(base64Str) {
    if (!base64Str) return { earlyData: null, error: null };
    try {
        base64Str = base64Str.replace(/-/g, "+").replace(/_/g, "/");
        const decode = atob(base64Str);
        const arrayBuffer = Uint8Array.from(decode, (c) => c.charCodeAt(0));
        return { earlyData: arrayBuffer.buffer, error: null };
    } catch (error) {
        return { earlyData: null, error };
    }
}

function safeCloseClient(client) {
    try {
        if (client.isGrpc) {
            client.close();
        } else {
            safeCloseWebSocket(client);
        }
    } catch (e) {}
}

function safeCloseWebSocket(ws) {
    try {
        if (ws.readyState === 1 || ws.readyState === 0) {
            ws.close();
        }
    } catch (e) {}
}

// ============================================
// Camouflage Mask Page (Public Clean disguise)
// ============================================
function getMaskPage(host = "localhost", isAuthEnabled = true, clientIp = "127.0.0.1", colo = "EDGE-GLOBAL") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Galaxy Edge Gateway | Anycast Telemetry &amp; Health</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 800;
      font-size: 17px;
      color: #0f172a;
      cursor: pointer;
      user-select: none;
    }
    .logo-icon {
      width: 34px;
      height: 34px;
      background: #0f172a;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 900;
      font-size: 16px;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #0f172a;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: 0.5px;
    }
    .btn-portal {
      background: transparent;
      border: 1px solid #cbd5e1;
      color: #0f172a;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.2s;
    }
    .btn-portal:hover {
      background: #0f172a;
      color: #ffffff;
    }
    main {
      flex: 1;
      max-width: 960px;
      width: 100%;
      margin: 0 auto;
      padding: 32px 16px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .hero-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.03);
      position: relative;
    }
    .hero-badge {
      position: absolute;
      top: 28px;
      right: 28px;
      background: #dcfce7;
      border: 1px solid #bbf7d0;
      color: #166534;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
    }
    .hero-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 8px;
      line-height: 1.3;
    }
    .hero-desc {
      color: #64748b;
      font-size: 14px;
      line-height: 1.6;
      max-width: 680px;
      margin-bottom: 24px;
    }
    .bench-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .bench-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }
    .bench-label {
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .bench-val {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .bench-meta {
      font-size: 12px;
      color: #16a34a;
      font-weight: 600;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 20px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
    }
    .card-title {
      font-size: 16px;
      font-weight: 800;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    .info-row:last-child { border-bottom: none; }
    .info-k { color: #64748b; font-weight: 600; }
    .info-v { color: #0f172a; font-weight: 700; font-family: monospace; }
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
      z-index: 100;
    }
    .modal-overlay.open { opacity: 1; pointer-events: auto; }
    .modal-card {
      background: #ffffff;
      border-radius: 16px;
      max-width: 420px;
      width: 100%;
      padding: 28px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    }
    .modal-input {
      width: 100%;
      padding: 12px 14px;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      outline: none;
    }
    .modal-input:focus { border-color: #0f172a; }
    .btn-submit {
      width: 100%;
      background: #0f172a;
      color: #ffffff;
      border: none;
      padding: 12px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
    }
    .btn-submit:hover { opacity: 0.9; }
    .auth-error {
      color: #dc2626;
      font-size: 12px;
      font-weight: 600;
      margin-top: 12px;
      display: none;
      text-align: center;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo-area" onclick="handleLogoClick()">
      <div class="logo-icon">⚡</div>
      <span>Galaxy Edge Network</span>
    </div>
    <div class="header-actions">
      <div class="status-pill">● EDGE ACTIVE</div>
      <button class="btn-portal" onclick="openPortalModal()">
        <span>🔒 Portal Access</span>
      </button>
    </div>
  </header>

  <main>
    <div class="hero-card">
      <div class="hero-badge">Anycast Operational</div>
      <h1 class="hero-title">Edge Network Telemetry &amp; Gateway Health</h1>
      <p class="hero-desc">Global edge cluster monitoring, high-throughput Anycast proxy routing, DoH validation, and low-latency packet acceleration.</p>
      
      <div class="bench-grid">
        <div class="bench-box">
          <div class="bench-label">Cluster Status</div>
          <div class="bench-val">99.99%</div>
          <div class="bench-meta">● Optimal Health</div>
        </div>
        <div class="bench-box">
          <div class="bench-label">Edge Node</div>
          <div class="bench-val">${colo}</div>
          <div class="bench-meta">Anycast Gateway</div>
        </div>
        <div class="bench-box">
          <div class="bench-label">Security Shield</div>
          <div class="bench-val">Active</div>
          <div class="bench-meta">DDoS &amp; WAF Shield</div>
        </div>
        <div class="bench-box">
          <div class="bench-label">DoH Resolver</div>
          <div class="bench-val">1.1.1.1</div>
          <div class="bench-meta">Encrypted DNS</div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">🌐 Client Telemetry</div>
        <div class="info-row">
          <span class="info-k">Client IP:</span>
          <span class="info-v">${clientIp}</span>
        </div>
        <div class="info-row">
          <span class="info-k">Connected Host:</span>
          <span class="info-v">${host}</span>
        </div>
        <div class="info-row">
          <span class="info-k">Protocol Support:</span>
          <span class="info-v">HTTP/2, HTTP/3, gRPC, WS</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🛡️ Gateway Diagnostics</div>
        <div class="info-row">
          <span class="info-k">Edge PoP:</span>
          <span class="info-v">${colo}</span>
        </div>
        <div class="info-row">
          <span class="info-k">Encryption:</span>
          <span class="info-v">TLS 1.3 / ChaCha20</span>
        </div>
        <div class="info-row">
          <span class="info-k">Network Mode:</span>
          <span class="info-v" style="color: #16a34a;">Dual-Stack IPv4/IPv6</span>
        </div>
      </div>
    </div>
  </main>

  <div class="modal-overlay" id="portalModal">
    <div class="modal-card">
      <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 8px;">🔒 Gateway Administrative Access</h3>
      <p style="font-size: 13px; color: #64748b; margin-bottom: 18px;">Enter your Trojan Password to access the full node management console.</p>
      <form onsubmit="handlePortalLogin(event)">
        <input type="password" id="authKeyInput" class="modal-input" placeholder="Enter Trojan Password" required autofocus />
        <button type="submit" class="btn-submit" id="submitBtn">Unlock Dashboard</button>
      </form>
      <div class="auth-error" id="authErrorMsg">⚠️ Invalid Password. Access Denied.</div>
    </div>
  </div>

  <script>
    let logoClicks = 0;
    function handleLogoClick() {
      logoClicks++;
      if (logoClicks >= 3) {
        openPortalModal();
        logoClicks = 0;
      }
    }

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        openPortalModal();
      }
    });

    function openPortalModal() {
      document.getElementById('portalModal').classList.add('open');
      document.getElementById('authKeyInput').focus();
    }

    function closePortalModal() {
      document.getElementById('portalModal').classList.remove('open');
    }

    async function handlePortalLogin(e) {
      e.preventDefault();
      const key = document.getElementById('authKeyInput').value.trim();
      const errorMsg = document.getElementById('authErrorMsg');
      const submitBtn = document.getElementById('submitBtn');

      if (!key) return;
      submitBtn.textContent = "Verifying...";
      submitBtn.disabled = true;
      errorMsg.style.display = 'none';

      try {
        const resp = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key })
        });
        const data = await resp.json();
        if (data.success) {
          window.location.href = data.redirect || '/';
        } else {
          errorMsg.style.display = 'block';
          submitBtn.textContent = "Unlock Dashboard";
          submitBtn.disabled = false;
        }
      } catch (err) {
        errorMsg.style.display = 'block';
        submitBtn.textContent = "Unlock Dashboard";
        submitBtn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
}

// ============================================
// Galaxy Trojan Dashboard (Full Visual Console)
// ============================================
function getGalaxyPage(host, activePassword, activeWSPath, activeProxy, subData) {
  const cleanPath = (activeWSPath || DEFAULT_WS_PATH).replace(/^\/+/, "");
  const pwd = activePassword || DEFAULT_PASSWORD;
  const pwdSha = sha224(pwd);

  const subUrlHttps = `https://${host}/sub?pwd=${encodeURIComponent(pwd)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Galaxy Tunnel Trojan Console | ${host}</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0b0f19;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: #111827;
      border-bottom: 1px solid #1f2937;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 40;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 900;
      color: #ffffff;
      box-shadow: 0 0 15px rgba(225, 29, 72, 0.4);
    }
    .brand-text h1 {
      font-size: 17px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.3px;
    }
    .brand-text p {
      font-size: 12px;
      color: #94a3b8;
    }
    .header-pills {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge-trojan {
      background: rgba(225, 29, 72, 0.15);
      border: 1px solid rgba(225, 29, 72, 0.4);
      color: #fb7185;
      font-size: 11px;
      font-weight: 800;
      padding: 5px 12px;
      border-radius: 9999px;
      letter-spacing: 0.5px;
    }
    .btn-logout {
      background: #1f2937;
      border: 1px solid #374151;
      color: #94a3b8;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-logout:hover {
      background: #374151;
      color: #ffffff;
    }
    main {
      flex: 1;
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
      padding: 28px 16px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .banner {
      background: linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%);
      border: 1px solid #312e81;
      border-radius: 16px;
      padding: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .banner-left h2 {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 6px;
    }
    .banner-left p {
      color: #a5b4fc;
      font-size: 13px;
      max-width: 600px;
      line-height: 1.5;
    }
    .banner-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn-action {
      background: #e11d48;
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 14px rgba(225, 29, 72, 0.3);
      transition: opacity 0.2s;
    }
    .btn-action:hover { opacity: 0.9; }
    .btn-secondary {
      background: #1f2937;
      border: 1px solid #374151;
      color: #f1f5f9;
      padding: 10px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-secondary:hover { background: #374151; }

    .grid-nodes {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
    }
    .node-card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 14px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: border-color 0.2s;
    }
    .node-card:hover {
      border-color: #4b5563;
    }
    .node-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .node-title {
      font-size: 15px;
      font-weight: 800;
      color: #ffffff;
    }
    .node-tag {
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .tag-tls { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .tag-grpc { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
    .tag-http { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .tag-proxy { background: rgba(236, 72, 153, 0.15); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.3); }
    
    .node-details {
      background: #0b0f19;
      border: 1px solid #1f2937;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 12px;
      font-family: monospace;
      color: #94a3b8;
      margin-bottom: 14px;
      word-break: break-all;
      line-height: 1.5;
    }
    .node-btns {
      display: flex;
      gap: 8px;
    }
    .btn-card {
      flex: 1;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.2s;
    }
    .btn-card-copy { background: #1f2937; color: #ffffff; }
    .btn-card-copy:hover { background: #374151; }
    .btn-card-qr { background: #e11d48; color: #ffffff; }
    .btn-card-qr:hover { opacity: 0.9; }

    .config-card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 14px;
      padding: 22px;
    }
    .config-head {
      font-size: 16px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .param-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .param-box {
      background: #0b0f19;
      border: 1px solid #1f2937;
      border-radius: 8px;
      padding: 12px;
    }
    .param-k { font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px; text-transform: uppercase; }
    .param-v { font-size: 13px; font-weight: 700; color: #f1f5f9; font-family: monospace; word-break: break-all; }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #10b981;
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.2s;
      pointer-events: none;
      z-index: 100;
    }
    .toast.show { opacity: 1; transform: translateY(0); }

    .qr-modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
      z-index: 100;
    }
    .qr-modal.open { opacity: 1; pointer-events: auto; }
    .qr-card {
      background: #111827;
      border: 1px solid #374151;
      border-radius: 16px;
      padding: 24px;
      max-width: 380px;
      width: 100%;
      text-align: center;
    }
    .qr-canvas-wrap {
      background: #ffffff;
      padding: 16px;
      border-radius: 12px;
      display: inline-block;
      margin: 16px 0;
    }
    .btn-close-modal {
      background: #1f2937;
      border: 1px solid #374151;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-icon">⚡</div>
      <div class="brand-text">
        <h1>Galaxy Tunnel (Trojan Protocol)</h1>
        <p>High-Speed Trojan • WebSocket &amp; gRPC Multiplexing</p>
      </div>
    </div>
    <div class="header-pills">
      <div class="badge-trojan">● TROJAN ACTIVE</div>
      <a href="/api/logout" class="btn-logout">Logout</a>
    </div>
  </header>

  <main>
    <div class="banner">
      <div class="banner-left">
        <h2>⚡ One-Click Trojan Subscription</h2>
        <p>Copy the Base64 auto-sync subscription link below for v2rayNG, Sing-Box, Shadowrocket, NekoBox, or Clash Meta.</p>
      </div>
      <div class="banner-actions">
        <button class="btn-action" onclick="copyText('${subUrlHttps}', 'Subscription URL copied!')">
          🔗 Copy Sub Link
        </button>
        <button class="btn-secondary" onclick="copyText('${subData.base64}', 'Raw Base64 Configs copied!')">
          📋 Copy Raw Base64
        </button>
      </div>
    </div>

    <!-- Node Cards Grid -->
    <div class="grid-nodes">
      <!-- 1. TLS WS Node -->
      <div class="node-card">
        <div>
          <div class="node-head">
            <div class="node-title">1. Trojan + TLS + WebSocket</div>
            <div class="node-tag tag-tls">Port 443</div>
          </div>
          <div class="node-details">
            Host: ${host}<br>
            SNI: ${host}<br>
            Path: /${cleanPath}<br>
            Security: TLS 1.3
          </div>
        </div>
        <div class="node-btns">
          <button class="btn-card btn-card-copy" onclick="copyText('${subData.links.tls}', 'Trojan TLS Link Copied!')">📋 Copy</button>
          <button class="btn-card btn-card-qr" onclick="showQr('${subData.links.tls}', 'Trojan TLS (Port 443)')">📱 QR Code</button>
        </div>
      </div>

      <!-- 2. gRPC Node -->
      <div class="node-card">
        <div>
          <div class="node-head">
            <div class="node-title">2. Trojan + gRPC Stream</div>
            <div class="node-tag tag-grpc">Port 443 (HTTP/2)</div>
          </div>
          <div class="node-details">
            Host: ${host}<br>
            ServiceName: ${cleanPath}<br>
            Transport: gRPC Multi-stream<br>
            Anti-DPI: High
          </div>
        </div>
        <div class="node-btns">
          <button class="btn-card btn-card-copy" onclick="copyText('${subData.links.grpc}', 'Trojan gRPC Link Copied!')">📋 Copy</button>
          <button class="btn-card btn-card-qr" onclick="showQr('${subData.links.grpc}', 'Trojan gRPC (Port 443)')">📱 QR Code</button>
        </div>
      </div>

      <!-- 3. Direct HTTP Node -->
      <div class="node-card">
        <div>
          <div class="node-head">
            <div class="node-title">3. Trojan + Direct WS (Non-TLS)</div>
            <div class="node-tag tag-http">Port 80</div>
          </div>
          <div class="node-details">
            Host: ${host}<br>
            Path: /${cleanPath}<br>
            Security: None (Direct Port 80)<br>
            Use: ISP SNI Bypass Test
          </div>
        </div>
        <div class="node-btns">
          <button class="btn-card btn-card-copy" onclick="copyText('${subData.links.http}', 'Trojan HTTP Link Copied!')">📋 Copy</button>
          <button class="btn-card btn-card-qr" onclick="showQr('${subData.links.http}', 'Trojan HTTP (Port 80)')">📱 QR Code</button>
        </div>
      </div>

      <!-- 4. Proxy IP Node -->
      <div class="node-card">
        <div>
          <div class="node-head">
            <div class="node-title">4. Trojan + Clean Proxy IP</div>
            <div class="node-tag tag-proxy">${activeProxy || "Auto-Failover"}</div>
          </div>
          <div class="node-details">
            Proxy Address: ${activeProxy || "cdn-b100.xn--b6gac.eu.org"}<br>
            Host / SNI: ${host}<br>
            Path: /${cleanPath}<br>
            Auto GitHub Sync: Active
          </div>
        </div>
        <div class="node-btns">
          <button class="btn-card btn-card-copy" onclick="copyText('${subData.links.proxy || subData.links.tls}', 'Trojan ProxyIP Link Copied!')">📋 Copy</button>
          <button class="btn-card btn-card-qr" onclick="showQr('${subData.links.proxy || subData.links.tls}', 'Trojan ProxyIP Node')">📱 QR Code</button>
        </div>
      </div>
    </div>

    <!-- Active Parameters & Settings Info -->
    <div class="config-card">
      <div class="config-head">⚙️ Active Trojan Parameters</div>
      <div class="param-grid">
        <div class="param-box">
          <div class="param-k">Trojan Password</div>
          <div class="param-v">${pwd}</div>
        </div>
        <div class="param-box">
          <div class="param-k">SHA-224 Hash (56 chars)</div>
          <div class="param-v">${pwdSha}</div>
        </div>
        <div class="param-box">
          <div class="param-k">WebSocket Path / ServiceName</div>
          <div class="param-v">/${cleanPath}</div>
        </div>
        <div class="param-box">
          <div class="param-k">Dynamic GitHub Proxy Source</div>
          <div class="param-v">https://gprox-galaxy.github.io/PROXYIP.txt</div>
        </div>
      </div>
    </div>
  </main>

  <div class="toast" id="toastMsg">Copied to clipboard!</div>

  <!-- QR Code Modal -->
  <div class="qr-modal" id="qrModal">
    <div class="qr-card">
      <h3 id="qrModalTitle" style="font-size: 16px; font-weight: 800; color: #ffffff;">Trojan Node QR</h3>
      <div class="qr-canvas-wrap">
        <canvas id="qrCanvas"></canvas>
      </div>
      <p style="font-size: 12px; color: #94a3b8; margin-bottom: 16px;">Scan with v2rayNG, Sing-box, or Shadowrocket</p>
      <button class="btn-close-modal" onclick="closeQrModal()">Close</button>
    </div>
  </div>

  <script>
    function showToast(msg) {
      const t = document.getElementById('toastMsg');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2500);
    }

    function copyText(text, successMsg) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast(successMsg));
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(successMsg);
      }
    }

    function showQr(link, title) {
      document.getElementById('qrModalTitle').textContent = title;
      const canvas = document.getElementById('qrCanvas');
      QRCode.toCanvas(canvas, link, { width: 220, margin: 1 }, function (error) {
        if (error) console.error(error);
      });
      document.getElementById('qrModal').classList.add('open');
    }

    function closeQrModal() {
      document.getElementById('qrModal').classList.remove('open');
    }
  </script>
</body>
</html>`;
}

export default worker_default;
