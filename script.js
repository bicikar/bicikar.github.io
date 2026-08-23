// Переключите значение на true, когда будут собраны фотографии всех гостей.
const SHOW_GUEST_PHOTOS = false;

// Тестовые данные. Замените объекты ниже данными гостей, которые дали согласие.
const guests = Array.from({ length: 30 }, (_, index) => ({
  name: `Имя Фамилия ${String(index + 1).padStart(2, "0")}`,
  role: "Проект / роль",
  telegram: "telegram_nick",
  photo: "",
}));

const guestGrid = document.querySelector("#guestGrid");
const guestCarousel = guestGrid?.closest(".guest-carousel");
const guestExpandButton = document.querySelector("#guestExpandButton");

const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const guestCard = (guest, index) => {
  const card = document.createElement("article");
  card.className = `guest-card${SHOW_GUEST_PHOTOS ? " guest-card--with-photo" : ""}`;
  card.setAttribute("role", "listitem");
  card.setAttribute("aria-posinset", String(index + 1));
  card.setAttribute("aria-setsize", String(guests.length));
  card.dataset.guestIndex = String(index);

  const media = SHOW_GUEST_PHOTOS
    ? guest.photo
      ? `<img class="guest-photo" src="${guest.photo}" alt="${guest.name}" loading="lazy">`
      : `<div class="guest-photo-placeholder" aria-hidden="true">${initials(guest.name)}</div>`
    : "";

  const username = guest.telegram.replace(/^@/, "");

  card.innerHTML = `
    ${media}
    <div>
      <h3>${guest.name}</h3>
      <p class="guest-role">${guest.role}</p>
    </div>
    <a
      class="guest-contact"
      href="https://t.me/${username}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Написать ${guest.name} в Telegram"
    >@${username} ↗</a>
  `;

  return card;
};

if (guestGrid) {
  const fragment = document.createDocumentFragment();
  guests.forEach((guest, index) => fragment.append(guestCard(guest, index)));
  guestGrid.append(fragment);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)");
  const requestFrame = window.requestAnimationFrame?.bind(window)
    ?? ((callback) => window.setTimeout(() => callback(Date.now()), 16));
  const cancelFrame = window.cancelAnimationFrame?.bind(window) ?? window.clearTimeout;
  const autoScrollSpeed = 24;
  const interactionPause = 3000;
  const loopBuffer = Math.min(8, Math.max(2, Math.floor(guests.length / 3)));
  let scrollFrame = 0;
  let resizeFrame = 0;
  let previousFrameTime = 0;
  let autoScrollRemainder = 0;
  let pauseUntil = 0;
  let viewportPause = "IntersectionObserver" in window;
  let isExpanded = false;
  let isRebalancing = false;
  let dragPointerId = null;
  let dragLastX = 0;
  let didDrag = false;
  let suppressClick = false;

  const cards = () => [...guestGrid.querySelectorAll(".guest-card")];
  const cardLeft = (card) => card.offsetLeft - guestGrid.offsetLeft;
  const cardAdvance = () => {
    const orderedCards = cards();
    if (orderedCards.length > 1) {
      return orderedCards[1].offsetLeft - orderedCards[0].offsetLeft;
    }

    const gap = Number.parseFloat(getComputedStyle(guestGrid).columnGap) || 0;
    return orderedCards[0].getBoundingClientRect().width + gap;
  };

  const pauseAfterInteraction = () => {
    pauseUntil = Date.now() + interactionPause;
    previousFrameTime = 0;
    autoScrollRemainder = 0;
  };

  const autoScrollIsPaused = () =>
    isExpanded
    || dragPointerId !== null
    || Date.now() < pauseUntil
    || viewportPause
    || document.hidden
    || reducedMotion.matches;

  const centerCard = (card) => {
    let orderedCards = cards();
    let cardIndex = orderedCards.indexOf(card);

    while (cardIndex < loopBuffer) {
      guestGrid.prepend(guestGrid.lastElementChild);
      cardIndex += 1;
    }

    while (cardIndex > loopBuffer) {
      guestGrid.append(guestGrid.firstElementChild);
      cardIndex -= 1;
    }

    guestGrid.scrollLeft = cardLeft(card);
  };

  const maintainInfiniteLoop = () => {
    if (isExpanded || isRebalancing) return;

    const advance = cardAdvance();
    if (!advance) return;

    const lowerLimit = advance * (loopBuffer - 2);
    const upperLimit = advance * (loopBuffer + 2);
    let safety = guests.length;
    isRebalancing = true;

    while (guestGrid.scrollLeft > upperLimit && safety > 0) {
      guestGrid.append(guestGrid.firstElementChild);
      guestGrid.scrollLeft -= advance;
      safety -= 1;
    }

    while (guestGrid.scrollLeft < lowerLimit && safety > 0) {
      guestGrid.prepend(guestGrid.lastElementChild);
      guestGrid.scrollLeft += advance;
      safety -= 1;
    }

    isRebalancing = false;
  };

  const sortCardsLogically = () => {
    cards()
      .sort((first, second) => Number(first.dataset.guestIndex) - Number(second.dataset.guestIndex))
      .forEach((card) => guestGrid.append(card));
  };

  const animateGuestCarousel = (time) => {
    const elapsed = previousFrameTime ? Math.min(time - previousFrameTime, 64) : 0;
    previousFrameTime = time;

    if (!autoScrollIsPaused()) {
      autoScrollRemainder += (autoScrollSpeed * elapsed) / 1000;
      const wholePixels = Math.floor(autoScrollRemainder);

      if (wholePixels) {
        guestGrid.scrollLeft += wholePixels;
        autoScrollRemainder -= wholePixels;
        maintainInfiniteLoop();
      }
    } else {
      autoScrollRemainder = 0;
    }

    requestFrame(animateGuestCarousel);
  };

  guestGrid.addEventListener("mouseenter", () => {
    if (supportsHover.matches) pauseAfterInteraction();
  });

  guestGrid.addEventListener("pointerdown", (event) => {
    if (isExpanded || !event.isPrimary) return;
    pauseAfterInteraction();
    dragPointerId = event.pointerId;
    dragLastX = event.clientX;
    didDrag = false;

    if (event.pointerType === "mouse") guestGrid.setPointerCapture(event.pointerId);
  });

  guestGrid.addEventListener("pointermove", (event) => {
    if (event.pointerId !== dragPointerId) return;
    pauseAfterInteraction();
    if (event.pointerType !== "mouse") return;

    const distance = event.clientX - dragLastX;
    if (Math.abs(distance) < 1 && !didDrag) return;

    didDrag = true;
    dragLastX = event.clientX;
    guestGrid.classList.add("is-dragging");
    guestGrid.scrollLeft -= distance;
    maintainInfiniteLoop();
    event.preventDefault();
  });

  const finishPointerInteraction = (event) => {
    if (event.pointerId !== dragPointerId) return;

    if (guestGrid.hasPointerCapture?.(event.pointerId)) {
      guestGrid.releasePointerCapture(event.pointerId);
    }

    guestGrid.classList.remove("is-dragging");
    suppressClick = didDrag;
    dragPointerId = null;
    maintainInfiniteLoop();
    pauseAfterInteraction();
    window.setTimeout(() => {
      suppressClick = false;
    }, 0);
  };

  window.addEventListener("pointerup", finishPointerInteraction);
  window.addEventListener("pointercancel", finishPointerInteraction);

  guestGrid.addEventListener("click", (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  guestGrid.addEventListener("wheel", pauseAfterInteraction, { passive: true });
  guestGrid.addEventListener("focusin", pauseAfterInteraction);

  guestGrid.addEventListener("keydown", (event) => {
    if (isExpanded || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    pauseAfterInteraction();
    const distance = cardAdvance() * (event.key === "ArrowRight" ? 1 : -1);

    if (guestGrid.scrollBy) {
      guestGrid.scrollBy({ left: distance, behavior: "smooth" });
    } else {
      guestGrid.scrollLeft += distance;
    }
  });

  guestGrid.addEventListener("scroll", () => {
    if (isExpanded) return;
    cancelFrame(scrollFrame);
    scrollFrame = requestFrame(maintainInfiniteLoop);
  }, { passive: true });

  guestExpandButton?.addEventListener("click", () => {
    isExpanded = !isExpanded;
    isRebalancing = true;
    guestCarousel?.classList.toggle("is-expanded", isExpanded);
    guestExpandButton.setAttribute("aria-expanded", String(isExpanded));
    guestExpandButton.textContent = isExpanded ? "Свернуть список" : "Раскрыть полностью";
    guestGrid.tabIndex = isExpanded ? -1 : 0;

    if (isExpanded) {
      sortCardsLogically();
      guestGrid.scrollLeft = 0;
      isRebalancing = false;
      return;
    }

    requestFrame(() => {
      const firstGuest = guestGrid.querySelector('[data-guest-index="0"]');
      centerCard(firstGuest);
      isRebalancing = false;
      pauseAfterInteraction();
    });
  });

  document.addEventListener("visibilitychange", () => {
    previousFrameTime = 0;
  });

  if ("IntersectionObserver" in window) {
    const carouselObserver = new window.IntersectionObserver(([entry]) => {
      viewportPause = !entry.isIntersecting;
      previousFrameTime = 0;
    }, { threshold: 0.1 });
    carouselObserver.observe(guestGrid);
  }

  reducedMotion.addEventListener?.("change", () => {
    previousFrameTime = 0;
  });

  window.addEventListener("resize", () => {
    cancelFrame(resizeFrame);
    resizeFrame = requestFrame(() => {
      if (isExpanded) return;
      const currentCard = cards().reduce((closest, card) =>
        Math.abs(cardLeft(card) - guestGrid.scrollLeft)
          < Math.abs(cardLeft(closest) - guestGrid.scrollLeft)
          ? card
          : closest);
      isRebalancing = true;
      centerCard(currentCard);
      isRebalancing = false;
    });
  }, { passive: true });

  requestFrame(() => {
    const firstGuest = guestGrid.querySelector('[data-guest-index="0"]');
    isRebalancing = true;
    centerCard(firstGuest);
    isRebalancing = false;
    requestFrame(animateGuestCarousel);
  });
}

const feedbackForm = document.querySelector("#feedbackForm");
const formStatus = document.querySelector("#formStatus");

document.querySelectorAll(".partner-logo").forEach((logo) => {
  const showFallback = () => {
    logo.hidden = true;
  };

  if (logo.complete && !logo.naturalWidth) {
    showFallback();
  } else {
    logo.addEventListener("error", showFallback, { once: true });
  }
});

feedbackForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const endpoint = feedbackForm.dataset.endpoint?.trim();
  const submitButton = feedbackForm.querySelector("button[type='submit']");

  if (!endpoint) {
    formStatus.dataset.state = "error";
    formStatus.textContent =
      "Форма пока работает как макет - перед публикацией подключим адрес для ответов.";
    return;
  }

  submitButton.disabled = true;
  formStatus.dataset.state = "";
  formStatus.textContent = "Отправляем…";

  try {
    const formData = new FormData(feedbackForm);
    const response = await fetch(endpoint, {
      method: "POST",
      body: new URLSearchParams(formData),
      mode: "no-cors",
      redirect: "follow",
      referrerPolicy: "no-referrer",
    });

    // Apps Script returns an opaque response for a cross-origin no-cors request.
    // A regular response is accepted only when its HTTP status is successful.
    if (response.type !== "opaque" && !response.ok) {
      throw new Error("Не удалось отправить форму");
    }

    feedbackForm.reset();
    formStatus.dataset.state = "success";
    formStatus.textContent = "Спасибо за искренность!";
  } catch (error) {
    formStatus.dataset.state = "error";
    formStatus.textContent = "Не получилось отправить. Попробуйте ещё раз чуть позже.";
  } finally {
    submitButton.disabled = false;
  }
});
