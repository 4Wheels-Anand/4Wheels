const $ = s => document.querySelector(s);
let adminData = null, activeTab = "bookings";
async function api(url, options={}) {
  const r = await fetch(url, { headers:{"Content-Type":"application/json"}, ...options });
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
async function checkLogin() {
  const state = await api("/api/admin/me");
  if (state.isAdmin) showDashboard();
}
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget).entries());
  try { await api("/api/admin/login", {method:"POST",body:JSON.stringify(d)}); $("#loginMsg").textContent=""; showDashboard(); }
  catch(err) { $("#loginMsg").textContent=err.message; $("#loginMsg").classList.add("error"); }
});
async function showDashboard() {
  $("#loginBox").hidden=true; $("#dashboard").hidden=false;
  await loadData();
}
async function loadData() {
  adminData = await api("/api/admin/data");
  $("#stats").innerHTML = `<div class="stat"><span>Total booking enquiries</span><b>${adminData.bookings.length}</b></div><div class="stat"><span>Partner enquiries</span><b>${adminData.partners.length}</b></div><div class="stat"><span>Cars in fleet</span><b>${adminData.cars.length}</b></div>`;
  renderTab();
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function statusSelect(type,id,status,opts){
  return `<select onchange="changeStatus('${type}',${id},this.value)">${opts.map(x=>`<option ${x===status?"selected":""}>${x}</option>`).join("")}</select>`;
}
function renderTab(){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===activeTab));
  $("#addCarBox").hidden=activeTab!=="cars";
  if(activeTab==="bookings"){
    $("#tableArea").innerHTML=`<div class="table-wrap"><table><thead><tr><th>ID / Date</th><th>Customer</th><th>Car / Service</th><th>Dates</th><th>Route</th><th>Status</th></tr></thead><tbody>${adminData.bookings.map(b=>`<tr><td>#${b.id}<br>${esc(b.created_at)}</td><td><b>${esc(b.customer_name)}</b><br>${esc(b.phone)}</td><td>${esc(b.car_name)}<br>${esc(b.service_type)}</td><td>${esc(b.start_date)}<br>to ${esc(b.end_date)}</td><td>${esc(b.pickup_location)}<br>→ ${esc(b.drop_location)}</td><td>${statusSelect("bookings",b.id,b.status,["New","Contacted","Confirmed","Completed","Cancelled"])}</td></tr>`).join("")||"<tr><td colspan='6'>No bookings yet.</td></tr>"}</tbody></table></div>`;
  } else if(activeTab==="partners"){
    $("#tableArea").innerHTML=`<div class="table-wrap"><table><thead><tr><th>ID / Date</th><th>Owner</th><th>Car</th><th>City / Registration</th><th>Expected monthly</th><th>Status</th></tr></thead><tbody>${adminData.partners.map(p=>`<tr><td>#${p.id}<br>${esc(p.created_at)}</td><td><b>${esc(p.owner_name)}</b><br>${esc(p.phone)}</td><td>${esc(p.car_model)}<br>${esc(p.year)}</td><td>${esc(p.city)}<br>${esc(p.registration)}</td><td>₹${Number(p.expected_monthly).toLocaleString("en-IN")}</td><td>${statusSelect("partners",p.id,p.status,["New","Contacted","Approved","Rejected"])}</td></tr>`).join("")||"<tr><td colspan='6'>No partner enquiries yet.</td></tr>"}</tbody></table></div>`;
  } else {
    $("#tableArea").innerHTML=`<div class="table-wrap"><table><thead><tr><th>Car</th><th>Category</th><th>Self drive / day</th><th>With driver / day</th><th>Visibility</th></tr></thead><tbody>${adminData.cars.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.category)}</td><td>₹${Number(c.self_drive_price).toLocaleString("en-IN")}</td><td>₹${Number(c.with_driver_price).toLocaleString("en-IN")}</td><td><button onclick="toggleCar(${c.id},${c.active?0:1})">${c.active?"Hide":"Show"}</button></td></tr>`).join("")}</tbody></table></div>`;
  }
}
window.changeStatus = async (type,id,status) => { try { await api(`/api/admin/${type}/${id}`,{method:"PATCH",body:JSON.stringify({status})}); await loadData(); } catch(e){alert(e.message);} };
window.toggleCar = async (id,active) => { try { await api(`/api/admin/cars/${id}`,{method:"PATCH",body:JSON.stringify({active})}); await loadData(); } catch(e){alert(e.message);} };
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{activeTab=b.dataset.tab;renderTab();}));
$("#addCarForm").addEventListener("submit",async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api("/api/admin/cars",{method:"POST",body:JSON.stringify(d)});$("#carMsg").textContent="Car added.";e.currentTarget.reset();await loadData();activeTab="cars";renderTab();}catch(err){$("#carMsg").textContent=err.message;$("#carMsg").classList.add("error");}});
$("#logout").addEventListener("click",async()=>{await api("/api/admin/logout",{method:"POST"});location.reload();});
checkLogin().catch(()=>{});
