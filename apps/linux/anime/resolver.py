"""One bounded request per process. Trusted anipy-api; no player/config/tracking ownership."""
import contextlib
import ipaddress
import json
import math
import socket
import sys
from urllib.parse import urlsplit

PROVIDERS = {"anidbapp", "animehub"}
LIMIT = 4 * 1024 * 1024


def public_https(value):
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("unsafe_url")
    return value


def install_network_guard():
    import requests
    original_dns = socket.getaddrinfo
    original_send = requests.Session.send

    def dns(host, port, *args, **kwargs):
        addresses = original_dns(host, port, *args, **kwargs)
        if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
            raise ValueError("private_network_denied")
        return addresses

    def send(session, request, **kwargs):
        public_https(request.url)
        session.trust_env = False
        session.max_redirects = 5
        kwargs.update(timeout=(8, 12), stream=True)
        response = original_send(session, request, **kwargs)
        if not response._content_consumed:
            body = bytearray()
            for chunk in response.iter_content(65536):
                body.extend(chunk)
                if len(body) > LIMIT:
                    response.close()
                    raise ValueError("response_too_large")
            response._content = bytes(body)
            response._content_consumed = True
        return response

    socket.getaddrinfo = dns
    requests.Session.send = send


def execute(request):
    install_network_guard()
    from anipy_api.provider import LanguageTypeEnum, get_provider
    provider_name = request["provider"]
    if provider_name not in PROVIDERS:
        raise ValueError("unknown_provider")
    provider = get_provider(provider_name)
    if provider is None:
        raise ValueError("provider_unavailable")
    if request["action"] == "search":
        query = request["query"].strip()
        if not 1 <= len(query) <= 160:
            raise ValueError("invalid_query")
        results = []
        for item in provider.get_search(query)[:20]:
            if LanguageTypeEnum.DUB not in item.languages and LanguageTypeEnum.UND not in item.languages:
                continue
            if not 1 <= len(item.identifier) <= 1024:
                continue
            results.append({"identifier": item.identifier, "name": item.name[:250], "dubListed": LanguageTypeEnum.DUB in item.languages})
        return {"results": results}
    if request["action"] != "resolve":
        raise ValueError("unknown_action")
    identifier = request["identifier"]
    if not isinstance(identifier, str) or not 1 <= len(identifier) <= 1024:
        raise ValueError("invalid_identity")
    episode = float(request["episode"])
    if not math.isfinite(episode) or episode <= 0 or episode > 100000:
        raise ValueError("invalid_episode")
    episode = int(episode) if episode.is_integer() else episode
    mode = LanguageTypeEnum.DUB
    episodes = provider.get_episodes(identifier, mode)
    if episode not in episodes or (request["film"] and len(episodes) != 1):
        return {"streams": [], "error": "dub_episode_unavailable"}
    streams = []
    for stream in provider.get_video(identifier, episode, mode)[:16]:
        if stream.language != mode:
            continue
        url = public_https(stream.url)
        referrer = public_https(stream.referrer) if stream.referrer else None
        subtitles = []
        for sub in (stream.subtitle or {}).values():
            if len(subtitles) >= 20:
                break
            subtitles.append({"url": public_https(sub.url), "language": sub.shortcode or sub.lang, "label": sub.lang})
        streams.append({"url": url, "resolution": max(0, min(int(stream.resolution), 4320)), "referrer": referrer, "hls": stream.container == "hls" or ".m3u8" in urlsplit(url).path, "subtitles": subtitles})
    return {"streams": streams}


def main():
    try:
        source = sys.stdin.buffer.readline(8193)
        if len(source) > 8192:
            raise ValueError("input_too_large")
        request = json.loads(source)
        # Provider libraries must never mix progress/logs with the JSON protocol.
        with contextlib.redirect_stdout(sys.stderr):
            result = execute(request)
        print(json.dumps({"ok": True, **result}, ensure_ascii=False))
    except Exception as error:
        # Never print URLs, CDN tokens, cookies or third-party exception strings.
        print(json.dumps({"ok": False, "error": type(error).__name__}))
        sys.exit(1)


if __name__ == "__main__":
    main()
