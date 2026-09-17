(function () {
  "use strict";

  function initializeClickFix() {
    const modal = document.getElementById("modeModal");
    const cards = document.querySelectorAll(
      "#modeModal .mode-card"
    );

    const modeSelect = document.getElementById("mode");
    const modeBadge = document.getElementById("modeBadge");
    const speedInput = document.getElementById("speed");
    const angleInput = document.getElementById("angle");
    const openButton = document.getElementById("openMode");

    const modeNames = {
      projectile: "포물선 운동",
      freefall: "자유 낙하",
      friction: "마찰 운동",
      drag: "공기저항과 바람",
      collision: "충돌",
      incline: "빗면 운동",
      circular: "원운동",
      torque: "돌림힘",
      escape: "탈출 속도"
    };

    const modeDefaults = {
      projectile: { speed: 15, angle: 60 },
      freefall: { speed: 0, angle: 270 },
      friction: { speed: 15, angle: 0 },
      drag: { speed: 20, angle: 35 },
      collision: { speed: 15, angle: 0 },
      incline: { speed: 0, angle: 0 },
      circular: { speed: 10, angle: 0 },
      torque: { speed: 0, angle: 0 },
      escape: { speed: 11200, angle: 0 }
    };

    if (!modal) {
      console.error(
        "[click-fix] #modeModal을 찾지 못했습니다."
      );
      return;
    }

    if (cards.length === 0) {
      console.error(
        "[click-fix] .mode-card를 찾지 못했습니다."
      );
      return;
    }

    /*
     * capture 단계에서 클릭을 먼저 처리합니다.
     * 다른 스크립트가 이벤트 전파를 막아도 실행될 가능성이 높습니다.
     */
    modal.addEventListener(
      "click",
      function (event) {
        const card = event.target.closest(".mode-card");

        if (!card || !modal.contains(card)) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        const mode =
          card.dataset.mode ||
          card.dataset.selectMode ||
          card.dataset.modeValue ||
          "projectile";

        const defaults =
          modeDefaults[mode] ||
          modeDefaults.projectile;

        if (modeSelect) {
          modeSelect.value = mode;
        }

        if (modeBadge) {
          modeBadge.textContent =
            modeNames[mode] || mode;
        }

        if (speedInput) {
          speedInput.value =
            String(defaults.speed);
        }

        if (angleInput) {
          angleInput.value =
            String(defaults.angle);
        }

        /*
         * class와 inline style을 모두 적용해
         * 기존 CSS가 꼬였어도 강제로 숨깁니다.
         */
        modal.classList.add("hidden");
        modal.style.setProperty(
          "display",
          "none",
          "important"
        );

        modal.style.setProperty(
          "pointer-events",
          "none",
          "important"
        );

        modal.setAttribute("aria-hidden", "true");

        console.log(
          "[click-fix] 선택 완료:",
          mode
        );

        /*
         * 기존 시뮬레이터에 문법 오류가 있어도
         * 여기까지는 독립적으로 실행됩니다.
         */
        if (modeSelect) {
          window.setTimeout(function () {
            try {
              modeSelect.dispatchEvent(
                new Event("change", {
                  bubbles: true
                })
              );
            } catch (error) {
              console.warn(
                "[click-fix] change 이벤트 오류:",
                error
              );
            }
          }, 0);
        }
      },
      true
    );

    if (openButton) {
      openButton.addEventListener(
        "click",
        function (event) {
          event.preventDefault();
          event.stopImmediatePropagation();

          modal.classList.remove("hidden");
          modal.style.setProperty(
            "display",
            "grid",
            "important"
          );

          modal.style.setProperty(
            "pointer-events",
            "auto",
            "important"
          );

          modal.removeAttribute("aria-hidden");
        },
        true
      );
    }

    /*
     * 카드 위에 다른 요소가 있더라도
     * 내부 아이콘과 텍스트가 이벤트를 가로채지 않게 처리합니다.
     */
    cards.forEach(function (card) {
      card.style.setProperty(
        "pointer-events",
        "auto",
        "important"
      );

      card.style.setProperty(
        "cursor",
        "pointer",
        "important"
      );

      Array.from(card.children).forEach(function (child) {
        child.style.setProperty(
          "pointer-events",
          "none",
          "important"
        );
      });
    });

    modal.style.setProperty(
      "pointer-events",
      "auto",
      "important"
    );

    console.log(
      "[click-fix] 준비 완료:",
      cards.length,
      "개 카드"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeClickFix
    );
  } else {
    initializeClickFix();
  }
})();
