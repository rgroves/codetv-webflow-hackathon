const dialogs = document.querySelectorAll("[data-map-dialog]");
console.log("dialogs: ", dialogs);

dialogs.forEach((dialog) => {
  const eyebrow = dialog.querySelector("[data-map-dialog-eyebrow]");
  const title = dialog.querySelector("[data-map-dialog-title]");
  const message = dialog.querySelector("[data-map-dialog-message]");
  const closeButtons = dialog.querySelectorAll("[data-map-dialog-close]");

  const closeDialog = () => {
    if (dialog.open) {
      dialog.close();
    }
  };

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeDialog);
  });

  dialog.addEventListener("pointerdown", (event) => {
    if (event.target !== dialog) {
      return;
    }

    const panel = dialog.querySelector(".map-dialog__panel");
    const panelRect = panel?.getBoundingClientRect();

    if (
      !panelRect ||
      event.clientX < panelRect.left ||
      event.clientX > panelRect.right ||
      event.clientY < panelRect.top ||
      event.clientY > panelRect.bottom
    ) {
      closeDialog();
    }
  });

  window.addEventListener("map-dialog:show", (event) => {
    const detail = (event).detail;

    console.log("dialog message: ", detail?.message);
    if (!detail?.message) {
      return;
    }

    if (detail?.eyebrow && eyebrow) {
      eyebrow.textContent = detail.eyebrow;
    }

    if (detail?.title && title) {
      title.textContent = detail.title;
    }

    if (detail?.message && message) {
      message.textContent = detail.message;
    }

    if (!dialog.open) {
      dialog.showModal();
    }
  });
});