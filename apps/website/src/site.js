(() => {
  const root = document.getElementById("nahhasio-review");
  const pages = [...root.querySelectorAll("[data-page]")];
  const guides = [...root.querySelectorAll("[data-guide]")];
  const dialog = root.querySelector("dialog");
  const search = dialog.querySelector("input");
  const results = [...dialog.querySelectorAll("li")];
  const status = dialog.querySelector("[role=status]");
  let hasNavigated = false;

  function navigate() {
    const [requested, article, heading] = location.hash.slice(1).split("/");
    const section = requested === "screenshots" ? "screenshots" : article;
    const page = pages.some((node) => node.dataset.page === requested) ? requested : "home";
    const guide = guides.some((node) => node.dataset.guide === article) ? article : "start";
    pages.forEach((node) => {
      node.hidden = node.dataset.page !== page;
    });
    guides.forEach((node) => {
      node.hidden = node.dataset.guide !== guide;
    });
    root.querySelectorAll("[data-outline]").forEach((node) => {
      node.hidden = node.dataset.outline !== guide;
    });
    root.querySelectorAll("[data-nav], [data-topic]").forEach((link) => {
      const selected =
        link.dataset.nav === page ||
        link.dataset.nav === `${page}/${section}` ||
        (page === "features" && link.dataset.nav === "home/features") ||
        (page === "docs" && link.dataset.topic === guide);
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    root.dataset.activePage = page;
    if (dialog.open) dialog.close();
    if (page === "docs" && heading) {
      document.getElementById(`${guide}-${heading}`)?.scrollIntoView({ block: "start" });
    } else if (page === "features" && article) {
      document.getElementById(`features-${article}`)?.scrollIntoView({ block: "start" });
    } else if (page === "home" && section) {
      document.getElementById(`home-${section}`)?.scrollIntoView({ block: "start" });
    } else if (hasNavigated) {
      root.scrollIntoView({ block: "start" });
    }
    hasNavigated = true;
  }

  function filter() {
    const query = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    for (const result of results) {
      result.hidden = !query.every((word) => result.dataset.text.includes(word));
    }
    const count = results.filter((result) => !result.hidden).length;
    status.textContent = query.length
      ? count
        ? `${count} ${count === 1 ? "guide" : "guides"} found`
        : "No guides match your search."
      : "";
  }

  function openSearch() {
    if (dialog.open) return;
    dialog.showModal();
    search.focus();
  }

  for (const button of root.querySelectorAll("[data-open-search]")) {
    button.addEventListener("click", openSearch);
  }
  search.addEventListener("input", filter);
  dialog.addEventListener("click", (event) => {
    if (event.target.closest("a")) dialog.close();
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    }
  });
  root.addEventListener("click", (event) => {
    const link = event.target.closest("a[href^='#']");
    if (link?.hash === location.hash) navigate();
  });
  window.addEventListener("hashchange", navigate);
  navigate();
})();
