(() => {
  "use strict";
  const ROOT_ID = "x-search-view-root";
  const STYLE_CLASS = "xsv-source-muted";
  let root;
  let list;
  let observer;
  let refreshTimer;
  const seen = new Set();

  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const text = (el) => clean(el?.innerText || el?.textContent || "");
  const absolute = (href) => {
    try { return new URL(href, location.origin).href; } catch { return ""; }
  };

  function make(tag, cls, content) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (content !== undefined) el.textContent = content;
    return el;
  }

  function getMetric(article, testid, label) {
    const node = article.querySelector(`[data-testid="${testid}"]`);
    if (!node) return "";
    const aria = node.getAttribute("aria-label") || "";
    const count = clean(node.innerText);
    return aria || count || label;
  }

  function extractPost(article) {
    const statusLink = [...article.querySelectorAll('a[href*="/status/"]')]
      .find(a => /\/[^/]+\/status\/\d+/.test(a.getAttribute("href") || ""));
    const postUrl = statusLink ? absolute(statusLink.getAttribute("href")) : "";
    const statusMatch = (statusLink?.getAttribute("href") || "").match(/\/([^/]+)\/status\/(\d+)/);
    const postId = statusMatch?.[2] || postUrl || "";
    if (!postId || seen.has(postId)) return null;

    const userNameNode = article.querySelector('[data-testid="User-Name"]');
    const userName = text(userNameNode) || "アカウント";
    const avatarNode = article.querySelector('img[src*="profile_images"]');
    const avatar = avatarNode?.currentSrc || avatarNode?.src || "";
    const username = statusMatch?.[1] || "";
    const bodyParts = [...article.querySelectorAll('[data-testid="tweetText"]')];
    const body = bodyParts.map(text).filter(Boolean).join("\n");
    const timeEl = article.querySelector("time");
    const time = timeEl?.getAttribute("datetime") || text(timeEl);

    const media = [];
    article.querySelectorAll('img').forEach(img => {
      const src = img.currentSrc || img.src || "";
      const alt = img.alt || "";
      if (src && !src.startsWith("data:") && !/profile_images|emoji|twemoji/i.test(src) &&
          (img.width > 80 || img.height > 80)) {
        media.push({type:"image", src, alt});
      }
    });
    article.querySelectorAll("video").forEach(video => {
      const src = video.currentSrc || video.src || video.querySelector("source")?.src || "";
      if (src) media.push({type:"video", src, alt:"Video"});
    });

    const links = [];
    article.querySelectorAll('[data-testid="tweetText"] a[href]').forEach(a => {
      const href = absolute(a.getAttribute("href"));
      const label = text(a) || href;
      if (href && !href.includes("/hashtag/") && !links.some(x => x.href === href)) {
        links.push({href, label});
      }
    });

    seen.add(postId);
    return {
      id: postId, userName, username, avatar, body, time, postUrl,
      media: media.slice(0, 6), links: links.slice(0, 8),
      replies: getMetric(article, "reply", "返信"),
      reposts: getMetric(article, "retweet", "リポスト"),
      likes: getMetric(article, "like", "いいね"),
      views: getMetric(article, "analytics", "表示")
    };
  }

  function renderPost(post) {
    const card = make("article", "xsv-card");
    const top = make("div", "xsv-topline");
    if (post.avatar) {
      const avatar = document.createElement("img");
      avatar.className = "xsv-avatar";
      avatar.src = post.avatar;
      avatar.alt = "";
      avatar.loading = "lazy";
      top.append(avatar);
    } else {
      top.append(make("div", "xsv-avatar xsv-avatar-placeholder", "•"));
    }
    const identity = make("div", "xsv-identity");
    identity.append(
      make("div", "xsv-author", post.userName),
      make("div", "xsv-time", post.time ? `投稿 · ${formatTime(post.time)}` : "投稿")
    );
    top.append(identity);
    card.append(top);

    if (post.username) {
      const heading = make("a", "xsv-heading", post.username);
      if (post.postUrl) {
        heading.href = post.postUrl;
        heading.target = "_blank";
        heading.rel = "noopener noreferrer";
      }
      card.append(heading);
    }
    if (post.body) card.append(make("p", "xsv-body", post.body));

    if (post.media.length) {
      const mediaArea = make("div", "xsv-media-area");
      const reveal = make("button", "xsv-subtle-toggle", "コンテンツを表示");
      reveal.type = "button";
      const mediaContainer = make("div", "xsv-media");
      mediaContainer.hidden = true;
      const hide = make("button", "xsv-subtle-toggle", "隠す");
      hide.type = "button";
      hide.hidden = true;
      function clearMedia() {
        mediaContainer.querySelectorAll("video").forEach(v => { v.pause(); v.removeAttribute("src"); v.load(); });
        mediaContainer.replaceChildren();
        mediaContainer.hidden = true;
        hide.hidden = true;
        reveal.hidden = false;
      }
      reveal.addEventListener("click", () => {
        mediaContainer.replaceChildren();
        post.media.forEach(item => {
          if (item.type === "video") {
            const video = document.createElement("video");
            video.className = "xsv-video";
            video.controls = true;
            video.preload = "none";
            video.src = item.src;
            video.setAttribute("aria-label", "投稿動画");
            mediaContainer.append(video);
          } else {
            const img = document.createElement("img");
            img.className = "xsv-post-image";
            img.alt = item.alt || "投稿画像";
            img.loading = "lazy";
            img.src = item.src;
            mediaContainer.append(img);
          }
        });
        mediaContainer.hidden = false;
        reveal.hidden = true;
        hide.hidden = false;
      });
      hide.addEventListener("click", clearMedia);
      mediaArea.append(reveal, mediaContainer, hide);
      card.append(mediaArea);
    }

    if (post.links.length) {
      const linkArea = make("div", "xsv-links");
      post.links.forEach(item => {
        const a = make("a", "xsv-link", item.label);
        a.href = item.href; a.target = "_blank"; a.rel = "noopener noreferrer";
        linkArea.append(a);
      });
      card.append(linkArea);
    }

    const details = make("div", "xsv-details");
    const toggle = make("button", "xsv-subtle-toggle", "詳細");
    toggle.type = "button";
    const metrics = make("div", "xsv-bottomline");
    metrics.hidden = true;
    metrics.append(metric("返信", post.replies), metric("リポスト", post.reposts), metric("いいね", post.likes), metric("表示", post.views));
    toggle.addEventListener("click", () => {
      metrics.hidden = !metrics.hidden;
      toggle.textContent = metrics.hidden ? "詳細" : "詳細を隠す";
    });
    details.append(toggle, metrics);
    card.append(details);

    const postLink = make("a", "xsv-post-link", "投稿を開く");
    if (post.postUrl) {
      postLink.href = post.postUrl;
      postLink.target = "_blank";
      postLink.rel = "noopener noreferrer";
    }
    card.append(postLink);
    return card;
  }

  function metric(label, value) {
    const el = make("span", "xsv-metric");
    el.append(make("b", "", label), document.createTextNode(value ? ` ${value}` : " —"));
    return el;
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("ja-JP", {
      year:"numeric", month:"2-digit", day:"2-digit",
      hour:"2-digit", minute:"2-digit"
    }).format(date);
  }

  function collect() {
    if (!list) return;
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    let added = 0;
    articles.forEach(article => {
      const post = extractPost(article);
      if (post) { list.append(renderPost(post)); added++; }
    });
    const count = root.querySelector(".xsv-count");
    if (count) count.textContent = `${list.children.length} 件の投稿`;
    const empty = root.querySelector(".xsv-empty");
    if (empty) empty.hidden = list.children.length > 0;
    return added;
  }

  function build() {
    if (document.getElementById(ROOT_ID)) return;
    root = make("div", "", undefined);
    root.id = ROOT_ID;
    const header = make("header", "xsv-header");
    const logo = make("div", "xsv-logo");
    logo.setAttribute("aria-label", "Google");
    logo.append(document.createTextNode("G"));
    const oo = make("strong", "xsv-logo-oo", "oo");
    logo.append(oo, document.createTextNode("gle"));
    const search = make("div", "xsv-searchbox", "投稿を検索");
    const count = make("div", "xsv-count", "投稿を読み込み中…");
    header.append(logo, search, count);
    list = make("main", "xsv-list");
    const empty = make("p", "xsv-empty", "表示できる投稿がありません。Xのタイムラインを開き、少しスクロールしてください。");
    list.append(empty);
    const footer = make("footer", "xsv-footer", "表示内容は現在読み込まれているXの投稿に基づきます。");
    root.append(header, list, footer);
    document.documentElement.append(root);

    const close = make("button", "xsv-close", "元の表示");
    close.type = "button";
    close.addEventListener("click", () => {
      root.remove();
      document.documentElement.classList.remove("xsv-active");
      if (observer) observer.disconnect();
    });
    header.append(close);
    document.documentElement.classList.add("xsv-active");
    collect();
  }

  function scheduleCollect() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(collect, 250);
  }

  function init() {
    build();
    if (observer) observer.disconnect();
    observer = new MutationObserver(scheduleCollect);
    observer.observe(document.body, {childList:true, subtree:true});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {once:true});
  } else {
    init();
  }
})();