const $ = (s) => document.querySelector(s);
let cars = [];
let config = { whatsappNumber: "916005447802", businessCity: "Kanpur" };
let currentFilter = "all";

function money(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
function waLink(text) { return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(text)}`; }
function setMessage(el, msg, error=false) { el.textContent = msg; el.classList.toggle("error", error); }

async function init() {
  $("#yearNow").textContent = new Date().getFullYear();
  try {
    config = await fetch("/api/config").then(r => r.json());
    const [carRes] = await Promise.all([fetch("/api/cars")]);
    cars = await carRes.json();
    renderCars();
    ["#contactWhatsapp", "#floatingWa"].forEach(sel => $(sel).href = waLink("Hello 4Wheels, I need a rental car in " + config.businessCity + "."));
  } catch {
    $("#carGrid").innerHTML = '<p class="loading">Could not load cars. Please refresh the page.</p>';
  }
}
function renderCars() {
  const shown = cars.filter(c => currentFilter === "all" || c.category.toLowerCase().includes(currentFilter.toLowerCase()));
  $("#carGrid").innerHTML = shown.map(c => `
    <article class="car-card">
      <img class="car-image" src="${escapeHtml(c.imageUrl || "")}" alt="${escapeHtml(c.name)}" onerror="this.src='https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1000&q=80'">
      <div class="car-info"><span class="car-category">${escapeHtml(c.category.toUpperCase())}</span>
        <h3>${escapeHtml(c.name)}</h3>
        <div class="car-specs"><span>${c.seats} seats</span><span>${escapeHtml(c.transmission)}</span><span>${escapeHtml(c.fuel)}</span></div>
        <div class="price-lines"><div><span>Self drive</span><b>${money(c.selfDrivePrice)}</b><small> / day*</small></div><div><span>With driver</span><b>${money(c.withDriverPrice)}</b><small> / day*</small></div></div>
        <button class="button button-gold" onclick="openBooking(${c.id})">Enquire / Book ↗</button>
      </div>
    </article>`).join("") || '<p class="loading">No cars in this category yet.</p>';
}
function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
window.openBooking = function(id) {
  const car = cars.find(c => c.id === id);
  if (!car) return;
  $("#bookingCarId").value = car.id;
  $("#selectedCarLabel").textContent = `${car.name} · ${car.category}`;
  $("#bookingMessage").textContent = "";
  $("#bookingModal").classList.add("open");
  $("#bookingModal").setAttribute("aria-hidden", "false");
};
function closeModal() {
  $("#bookingModal").classList.remove("open");
  $("#bookingModal").setAttribute("aria-hidden", "true");
}
document.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", closeModal));
document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".filter").forEach(x => x.classList.remove("active"));
  btn.classList.add("active"); currentFilter = btn.dataset.filter; renderCars();
}));
$("#menuToggle").addEventListener("click", () => $(".site-header").classList.toggle("nav-open"));
document.querySelectorAll("nav a").forEach(a => a.addEventListener("click", () => $(".site-header").classList.remove("nav-open")));

$("#bookingForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const msg = $("#bookingMessage");
  setMessage(msg, "Sending your request…");
  try {
    const response = await fetch("/api/bookings", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not submit request.");
    const car = cars.find(c => c.id === Number(data.carId));
    const text = `Hello 4Wheels! I submitted a booking enquiry.\nBooking ID: ${result.bookingId}\nName: ${data.customerName}\nPhone: ${data.phone}\nCar: ${car?.name || ""}\nService: ${data.serviceType}\nDates: ${data.startDate} to ${data.endDate}\nPickup: ${data.pickupLocation}\nDrop: ${data.dropLocation}\nDetails: ${data.message || "N/A"}\nPlease confirm availability and final price.`;
    setMessage(msg, "Request saved! Opening WhatsApp so you can send the details to 4Wheels.");
    window.open(waLink(text), "_blank", "noopener");
    form.reset(); closeModal();
    alert("Your enquiry has been saved. WhatsApp will open with your booking details. Please press Send in WhatsApp.");
  } catch(err) { setMessage(msg, err.message, true); }
});

$("#partnerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const msg = $("#partnerMessage");
  setMessage(msg, "Submitting…");
  try {
    const response = await fetch("/api/partners", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not submit enquiry.");
    const text = `Hello 4Wheels! I want to attach my car as a partner.\nEnquiry ID: ${result.partnerId}\nOwner: ${data.ownerName}\nPhone: ${data.phone}\nCity: ${data.city}\nCar: ${data.carModel}\nYear: ${data.year}\nRegistration: ${data.registration}\nExpected monthly amount: ${data.expectedMonthly || "Not specified"}\nNotes: ${data.notes || "N/A"}\nPlease contact me about inspection and agreement.`;
    setMessage(msg, "Partner enquiry saved. Opening WhatsApp…");
    window.open(waLink(text), "_blank", "noopener");
    form.reset();
    alert("Partner enquiry saved. Please press Send in WhatsApp to contact 4Wheels.");
  } catch(err) { setMessage(msg, err.message, true); }
});
init();