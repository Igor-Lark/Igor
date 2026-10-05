const nav = document.getElementById("nav");
const toggle = document.getElementById("navToggle");
const links = document.getElementById("navLinks");

function onScroll() {
  nav.classList.toggle("is-solid", window.scrollY > 40);
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

toggle.addEventListener("click", () => {
  nav.classList.toggle("is-open");
});
links.addEventListener("click", (event) => {
  if (event.target.closest("a")) nav.classList.remove("is-open");
});

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
document.querySelectorAll(".gallery img").forEach((node) => {
  node.addEventListener("click", () => {
    lightboxImg.src = node.currentSrc || node.src;
    lightboxImg.alt = node.alt || "";
    lightbox.hidden = false;
    lightbox.classList.add("open");
  });
});
document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLightbox();
});
function closeLightbox() {
  lightbox.classList.remove("open");
  lightbox.hidden = true;
  lightboxImg.src = "";
}

document.getElementById("book").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const text = [
    "Здравствуйте! Хочу забронировать яхту Tigger.",
    `Имя: ${data.get("name")}`,
    `Телефон: ${data.get("phone")}`,
    data.get("when") ? `Детали: ${data.get("when")}` : ""
  ].filter(Boolean).join("\n");
  window.open(`https://wa.me/79183044000?text=${encodeURIComponent(text)}`, "_blank", "noopener");
});
