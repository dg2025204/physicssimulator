(function () {
  "use strict";

  function initializeModeSelector() {
    const modal = document.getElementById("modeModal");
    const modeSelect = document.getElementById("mode");
    const badge = document.getElementById("modeBadge");
    const speedInput = document.getElementById("speed");
    const angleInput = document.getElementById("angle");
    const openButton = document.getElementById("openModeButton");
    const cards = document.querySelectorAll("[data-select-mode]");

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
      console.error("modeModal 요소를 찾지 못했습니다.");
      return;
    }

    if (cards.length === 0) {
      console.error("data-select-mode 카드가 없습니다.");
      return;
    }

    cards.forEach(function (card) {
      card.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        const selectedMode =
          card.getAttribute("data-select-mode");

        const defaults = modeDefaults[selectedMode];

        if (!selectedMode || !defaults) {
          console.error(
            "잘못된 운동 카드:",
            selectedMode
          );
          return;
        }

        if (modeSelect) {
          modeSelect.value = selectedMode;
        }

        if (badge) {
          badge.textContent =
            modeNames[selectedMode] || selectedMode;
        }

        if (speedInput) {
          speedInput.value = String(defaults.speed);
        }

        if (angleInput) {
          angleInput.value = String(defaults.angle);
        }

        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");

        document.body.classList.remove("modal-open");

        /*
         * 시뮬레이터가 정상 실행 중인 경우에만
         * 모드 변경 이벤트를 전달합니다.
         */
        if (modeSelect) {
          modeSelect.dispatchEvent(
            new Event("change", {
              bubbles: true
            })
          );
        }

        console.log(
          "운동 선택 완료:",
          selectedMode
        );
      });
    });

    if (openButton) {
      openButton.addEventListener("click", function (event) {
        event.preventDefault();

        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");

        document.body.classList.add("modal-open");
      });
    }

    /*
     * 배경 클릭으로 닫지 않습니다.
     * 카드 선택을 반드시 거치게 합니다.
     */
    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        event.stopPropagation();
      }
    });

    document.body.classList.add("modal-open");

    console.log(
      "운동 선택 창 준비 완료:",
      cards.length,
      "개 카드"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeModeSelector
    );
  } else {
    initializeModeSelector();
  }
})();
