import { Authenticate } from "../authentication/auth";
import { getDataset, updateDataset } from "../kv/handlers";
import { renderErrorPage } from "../pages/error";
import { renderHomePage } from "../pages/home";
import { initializeParams, origin } from "./init";

export function isValidUUID(uuid) {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(uuid);
}

export async function resolveDNS (domain) {
    const dohURL = 'https://cloudflare-dns.com/dns-query';
    const dohURLv4 = `${dohURL}?name=${encodeURIComponent(domain)}&type=A`;
    const dohURLv6 = `${dohURL}?name=${encodeURIComponent(domain)}&type=AAAA`;

    try {
        const [ipv4Response, ipv6Response] = await Promise.all([
            fetch(dohURLv4, { headers: { accept: 'application/dns-json' } }),
            fetch(dohURLv6, { headers: { accept: 'application/dns-json' } })
        ]);

        const ipv4Addresses = await ipv4Response.json();
        const ipv6Addresses = await ipv6Response.json();

        const ipv4 = ipv4Addresses.Answer
            ? ipv4Addresses.Answer.map((record) => record.data)
            : [];
        const ipv6 = ipv6Addresses.Answer
            ? ipv6Addresses.Answer.map((record) => record.data)
            : [];

        return { ipv4, ipv6 };
    } catch (error) {
        console.error('Error resolving DNS:', error);
        throw new Error(`An error occurred while resolving DNS - ${error}`);
    }
}

export function isDomain(address) {
    const domainPattern = /^(?!\-)(?:[A-Za-z0-9\-]{1,63}\.)+[A-Za-z]{2,}$/;
    return domainPattern.test(address);
}

export async function handlePanel(request, env) {
    await initializeParams(request, env);
    const auth = await Authenticate(request, env); 
    if (request.method === 'POST') {     
        if (!auth) return new Response('Unauthorized or expired session!', { status: 401 });             
        await updateDataset(request, env); 
        return new Response('Success', { status: 200 });
    }
        
    const { kvNotFound, proxySettings } = await getDataset(request, env);
    if (kvNotFound) return await renderErrorPage(request, env, 'KV Dataset is not properly set!', null, true);
    const pwd = await env.hafez.get('pwd');
    if (pwd && !auth) return Response.redirect(`${origin}/login`, 302);
    const isPassSet = pwd?.length >= 8;
    return await renderHomePage(request, env, proxySettings, isPassSet);
}

export async function fallback(request) {
    return new Response({"products": [
        {"id": "15", "name": "rice melted", "author": "jc minio", "Updated_at": "2023-02-11 23:09:17"},
        {"id": "16", "name": "ice cream", "author": "jc minio", "Updated_at": "2023-02-12 16:18:12"},
        {"id": "17", "name": "cup cake", "author": "jc minio", "Updated_at": "2023-02-29 23:52:38"},

    ]}, { status: 404 });

    const url = new URL(request.url);
    url.hostname = 'www.speedtest.net';
    url.protocol = 'https:';
    request = new Request(url, request);
    return await fetch(request);
}

export async function getMyIP(request) {
    const ip = await request.text();
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}?nocache=${Date.now()}`);
        const geoLocation = await response.json();
        return new Response(JSON.stringify(geoLocation), {
            status: 200,
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            }
        });
    } catch (error) {
        console.error('Error fetching IP address:', error);
    }
}