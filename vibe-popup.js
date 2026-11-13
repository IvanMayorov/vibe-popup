/**
 * vibe-popup.js — простой попап без зависимостей, с лёгкой анимацией появления и исчезания.
 * Вырос из попапа проекта Rocket и попапа статей курса «Вайбдизайнер».
 *
 *   const p = VibePopup.open({ content: "<h1>Привет</h1>", label: "Привет", onClose() {} });
 *   p.close();
 *
 * Закрывается крестиком, клавишей Esc, кликом по фону и любым элементом с [data-vibe-popup-close].
 * Пока попап открыт, остальная страница недоступна (inert) и не прокручивается.
 * Попапы можно открывать друг поверх друга: нижний отъезжает назад в стопку, Esc закрывает верхний.
 * Пока попап открыт, полоса прокрутки страницы заменяется отступом, и сайт не прыгает.
 */
(function (global) {
  const stack = [];

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !stack.length) return;
    e.preventDefault();
    stack[stack.length - 1].close();
  });

  // Компенсация скроллбара: когда страница перестаёт прокручиваться, её полоса прокрутки пропадает.
  // Чтобы сайт не прыгал вбок, на место полосы добавляется такой же отступ справа.
  // Ширина полосы лежит в переменной --vibe-popup-scrollbar: её можно добавить фиксированной шапке.
  let padBefore = "";
  function lock() {
    const html = document.documentElement;
    const bar = window.innerWidth - html.clientWidth;
    padBefore = html.style.paddingRight;
    if (bar > 0) {
      const pad = parseFloat(getComputedStyle(html).paddingRight) || 0;
      html.style.paddingRight = pad + bar + "px";
    }
    html.style.setProperty("--vibe-popup-scrollbar", Math.max(bar, 0) + "px");
    html.classList.add("vibe-popup-lock");
  }
  function unlock() {
    const html = document.documentElement;
    html.classList.remove("vibe-popup-lock");
    html.style.paddingRight = padBefore;
    html.style.removeProperty("--vibe-popup-scrollbar");
  }

  function open(opts = {}) {
    const back = document.activeElement;
    const root = document.createElement("div");
    root.className = "vibe-popup" + (opts.wide ? " vibe-popup--wide" : "");
    root.innerHTML =
      '<div class="vibe-popup__shade" data-vibe-popup-close></div>' +
      '<div class="vibe-popup__wrap"><div class="vibe-popup__panel" role="dialog" aria-modal="true" tabindex="-1">' +
      '<button class="vibe-popup__x" type="button" data-vibe-popup-close aria-label="Закрыть">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
      "</button>" +
      '<div class="vibe-popup__body"></div></div></div>';
    const panel = root.querySelector(".vibe-popup__panel");
    const body = root.querySelector(".vibe-popup__body");
    if (opts.label) panel.setAttribute("aria-label", opts.label);
    if (typeof opts.content === "string") body.innerHTML = opts.content;
    else if (opts.content instanceof Node) body.append(opts.content);

    // Остальная страница недоступна, как под модальным окном
    const made = [...document.body.children].filter((el) => !el.inert);
    made.forEach((el) => (el.inert = true));
    const under = stack[stack.length - 1];
    if (under) {
      // Нижний попап отъезжает назад: чуть меньше и выше, верхний встаёт перед ним
      under.el.classList.add("vibe-popup--behind");
      root.classList.add("vibe-popup--stacked");
    }
    document.body.append(root);
    if (!document.documentElement.classList.contains("vibe-popup-lock")) lock();

    let closed = false;
    const api = {
      el: root,
      body,
      close() {
        if (closed) return;
        closed = true;
        // Сначала короткая анимация исчезания (120 мс), потом окно убирается со страницы
        const fast = matchMedia("(prefers-reduced-motion: reduce)").matches;
        root.classList.add("vibe-popup--out");
        root.style.pointerEvents = "none";
        // Прокрутку страницы возвращаем только после того, как окно погасло:
        // иначе полоса прокрутки появится раньше и гаснущее окно дёрнется вбок
        // Длительность берётся из CSS: обычное окно гаснет за 120 мс, окно из стопки уезжает вниз за 200 мс
        const ms = fast ? 0 : Math.max(...[panel, wrap].map((el) => parseFloat(getComputedStyle(el).animationDuration) * 1000 || 0));
        setTimeout(() => {
          root.remove();
          if (!stack.length) unlock();
        }, ms);
        made.forEach((el) => (el.inert = false));
        stack.splice(stack.indexOf(api), 1);
        if (stack.length) stack[stack.length - 1].el.classList.remove("vibe-popup--behind");
        if (back && back.focus) back.focus({ preventScroll: true });
        opts.onClose && opts.onClose();
      },
    };
    // Прокрутка не застревает: когда внутренний блок со скроллом докручен до конца, колесо крутит сам слой попапа
    const wrap = root.querySelector(".vibe-popup__wrap");
    wrap.addEventListener("wheel", (e) => {
      if (e.ctrlKey || !e.deltaY) return;
      let el = e.target;
      for (; el && el !== wrap; el = el.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1) {
          if (e.deltaY < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return;
          break;
        }
      }
      if (!el || el === wrap) return;
      e.preventDefault();
      wrap.scrollTop += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? wrap.clientHeight : 1);
    }, { passive: false });
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-vibe-popup-close]") || e.target.classList.contains("vibe-popup__wrap")) api.close();
    });
    stack.push(api);
    panel.focus({ preventScroll: true });
    return api;
  }

  global.VibePopup = { open, closeAll: () => [...stack].reverse().forEach((p) => p.close()) };
})(window);
