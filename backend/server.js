require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const db = new Database(path.join(__dirname, "4wheels.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ADD-ON 1: ADMIN LOGIN + OTP
const ADMINS = {
  "4wheelsAnand": process.env.ADMIN_ANAND_,
  "4wheelsShashank": process.env.ADMIN_SHASHANK_,
  "4wheelsSanu": process.env.ADMIN_SANU_,
};
let otpStore = {};
db.exec(`
CREATE TABLE IF NOT EXISTS cars (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL,
 seats INTEGER NOT NULL DEFAULT 5, transmission TEXT NOT NULL DEFAULT 'Manual',
 fuel TEXT NOT NULL DEFAULT 'Petrol', self_drive_price INTEGER NOT NULL DEFAULT 0,
 with_driver_price INTEGER NOT NULL DEFAULT 0, image_url TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS bookings (
 id INTEGER PRIMARY KEY AUTOINCREMENT, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
 car_id INTEGER, car_name TEXT NOT NULL, service_type TEXT NOT NULL,
 pickup_location TEXT NOT NULL, drop_location TEXT NOT NULL, start_date TEXT NOT NULL,
 end_date TEXT NOT NULL, message TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'New',
 total_amount INTEGER NOT NULL DEFAULT 0, paid_amount INTEGER NOT NULL DEFAULT 0,
 payment_status TEXT NOT NULL DEFAULT 'Unpaid',
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 FOREIGN KEY(car_id) REFERENCES cars(id)
);
CREATE TABLE IF NOT EXISTS partners (
 id INTEGER PRIMARY KEY AUTOINCREMENT, owner_name TEXT NOT NULL, phone TEXT NOT NULL,
 city TEXT NOT NULL, car_model TEXT NOT NULL, year TEXT NOT NULL, registration TEXT NOT NULL,
 expected_monthly INTEGER DEFAULT 0, notes TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'New',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS admin_tokens (
 token_hash TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')),
 expires_at TEXT NOT NULL
);
`);

function ensureColumn(table, name, definition) {
 const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name);
 if (!cols.includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}
ensureColumn("bookings","total_amount","INTEGER NOT NULL DEFAULT 0");
ensureColumn("bookings","paid_amount","INTEGER NOT NULL DEFAULT 0");
ensureColumn("bookings","payment_status","TEXT NOT NULL DEFAULT 'Unpaid'");

if (db.prepare("SELECT COUNT(*) n FROM cars").get().n === 0) {
 const add = db.prepare(`INSERT INTO cars
 (name,category,seats,transmission,fuel,self_drive_price,with_driver_price,image_url,description)
 VALUES (?,?,?,?,?,?,?,?,?)`);
 [
  ["Kia Sonet","Compact SUV",5,"Manual","Petrol",3000,4500,"/images/sonet.jpg","Sample listing. Replace with actual vehicle and approved photo."],
  ["Swift Dzire","sedan",5,"Manual","Petrol/Cng",2500,3500,"/images/dzire.jpg","Sample listing. Replace with actual vehicle and approved photo."],
  ["Mahindra Scorpio N","SUV",7,"Manual","Diesel",8000,10000,"/images/scorpion.jpg","Sample listing. Replace with actual vehicle and approved photo."],
  ["Toyota Innova","MPV",7,"Manual","Diesel",4000,5500,"/images/innova.jpg","Sample listing. Replace with actual vehicle and approved photo."],
  ["Toyota Fortuner","Premium SUV",7,"Automatic","Diesel",12000,14000,"/images/fortuner.jpg","Sample listing. Replace with actual vehicle and approved photo."]
 ].forEach(x=>add.run(...x));
}

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json({limit:"40kb"}));
app.use(express.urlencoded({extended:false,limit:"40kb"}));
app.use(session({
 name:"4wheels.sid", secret:process.env.SESSION_SECRET || "development-secret-change-before-launch",
 resave:false, saveUninitialized:false,
 cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:8*60*60*1000}
}));
const publicLimiter=rateLimit({windowMs:15*60*1000,limit:80,standardHeaders:true,legacyHeaders:false});
app.use("/api/bookings",publicLimiter); app.use("/api/partners",publicLimiter);

const clean=(v,n=250)=>String(v??"").trim().slice(0,n);
const validPhone=v=>/^[0-9+\-\s]{10,16}$/.test(v);
const safeEqual=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);};
function adminOnly(req,res,next){
 if(req.session?.isAdmin) return next();
 const header=req.headers.authorization||"";
 const token=header.startsWith("Bearer ")?header.slice(7):"";
 if(token){
  const hash=crypto.createHash("sha256").update(token).digest("hex");
  const row=db.prepare("SELECT expires_at FROM admin_tokens WHERE token_hash=?").get(hash);
  if(row && Date.parse(row.expires_at)>Date.now()) return next();
 }
 return res.status(401).json({error:"Please log in again."});
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"4Wheels API"}));
app.get("/api/config",(req,res)=>res.json({businessCity:process.env.BUSINESS_CITY||"Kanpur",whatsappNumber:process.env.WHATSAPP_NUMBER||"916005447802"}));
app.get("/api/cars",(req,res)=>res.json(db.prepare(`SELECT id,name,category,seats,transmission,fuel,self_drive_price AS selfDrivePrice,
 with_driver_price AS withDriverPrice,image_url AS imageUrl,description FROM cars WHERE active=1 ORDER BY id`).all()));

app.post("/api/bookings",(req,res)=>{
 const b=req.body||{}, customer=clean(b.customerName,100),phone=clean(b.phone,20),
 pickup=clean(b.pickupLocation,160),drop=clean(b.dropLocation,160),
 start=clean(b.startDate,20),end=clean(b.endDate,20),service=clean(b.serviceType,30),
 message=clean(b.message,500),car=db.prepare("SELECT id,name FROM cars WHERE id=? AND active=1").get(Number(b.carId));
 if(!customer||!validPhone(phone)||!pickup||!drop||!start||!end||!["Self Drive","With Driver"].includes(service)||!car)
  return res.status(400).json({error:"Please complete all required fields correctly."});
 if(Number.isNaN(Date.parse(start))||Number.isNaN(Date.parse(end))||end<start)
  return res.status(400).json({error:"Please select valid travel dates."});
 const r=db.prepare(`INSERT INTO bookings(customer_name,phone,car_id,car_name,service_type,pickup_location,drop_location,start_date,end_date,message)
 VALUES(?,?,?,?,?,?,?,?,?,?)`).run(customer,phone,car.id,car.name,service,pickup,drop,start,end,message);
 res.status(201).json({ok:true,bookingId:r.lastInsertRowid});
});
app.post("/api/partners",(req,res)=>{
 const p=req.body||{},owner=clean(p.ownerName,100),phone=clean(p.phone,20),city=clean(p.city,100),
 model=clean(p.carModel,100),year=clean(p.year,10),registration=clean(p.registration,30);
 if(!owner||!validPhone(phone)||!city||!model||!year||!registration)
  return res.status(400).json({error:"Please complete all required fields correctly."});
 const r=db.prepare(`INSERT INTO partners(owner_name,phone,city,car_model,year,registration,expected_monthly,notes)
 VALUES(?,?,?,?,?,?,?,?)`).run(owner,phone,city,model,year,registration,Math.max(0,Number(p.expectedMonthly)||0),clean(p.notes,500));
 res.status(201).json({ok:true,partnerId:r.lastInsertRowid});
});

function adminCredentialsOk(u,p){
 return safeEqual(clean(u,100),process.env.ADMIN_USERNAME||"admin") &&
 safeEqual(String(p||""),process.env.ADMIN_PASSWORD||"CHANGE_THIS_TO_A_LONG_UNIQUE_PASSWORD");
}
app.post("/api/admin/login",rateLimit({windowMs:15*60*1000,limit:10}), (req,res)=>{
 if(!adminCredentialsOk(req.body?.username,req.body?.password)) return res.status(401).json({error:"Incorrect username or password."});
 req.session.isAdmin=true; res.json({ok:true});
});
app.post("/api/admin/mobile-login",rateLimit({windowMs:15*60*1000,limit:10}), (req,res)=>{
 if(!adminCredentialsOk(req.body?.username,req.body?.password)) return res.status(401).json({error:"Incorrect username or password."});
 const token=crypto.randomBytes(48).toString("hex");
 const hash=crypto.createHash("sha256").update(token).digest("hex");
 const expires=new Date(Date.now()+30*24*60*60*1000).toISOString();
 db.prepare("INSERT INTO admin_tokens(token_hash,expires_at) VALUES(?,?)").run(hash,expires);
 res.json({ok:true,token,expiresAt:expires});
});
app.post("/api/admin/mobile-logout",adminOnly,(req,res)=>{
 const token=(req.headers.authorization||"").replace(/^Bearer /,"");
 if(token){const hash=crypto.createHash("sha256").update(token).digest("hex");db.prepare("DELETE FROM admin_tokens WHERE token_hash=?").run(hash);}
 res.json({ok:true});
});
app.post("/api/admin/logout",adminOnly,(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/admin/me",(req,res)=>res.json({isAdmin:!!req.session?.isAdmin}));
app.get("/api/admin/data",adminOnly,(req,res)=>{
 res.json({
  bookings:db.prepare("SELECT * FROM bookings ORDER BY id DESC LIMIT 500").all(),
  partners:db.prepare("SELECT * FROM partners ORDER BY id DESC LIMIT 500").all(),
  cars:db.prepare("SELECT * FROM cars ORDER BY id DESC").all()
 });
});
app.patch("/api/admin/bookings/:id",adminOnly,(req,res)=>{
 const status=clean(req.body?.status,30);
 if(!["New","Contacted","Confirmed","Completed","Cancelled"].includes(status)) return res.status(400).json({error:"Invalid status."});
 const r=db.prepare("UPDATE bookings SET status=? WHERE id=?").run(status,Number(req.params.id));
 res.json({ok:r.changes>0});
});
app.patch("/api/admin/bookings/:id/payment",adminOnly,(req,res)=>{
 const total=Math.max(0,Math.min(100000000,Number(req.body?.totalAmount)||0));
 const paid=Math.max(0,Math.min(total,Number(req.body?.paidAmount)||0));
 const status=paid===0?"Unpaid":paid>=total?"Paid":"Partially Paid";
 const r=db.prepare("UPDATE bookings SET total_amount=?,paid_amount=?,payment_status=? WHERE id=?").run(total,paid,status,Number(req.params.id));
 res.json({ok:r.changes>0,paymentStatus:status});
});
app.patch("/api/admin/partners/:id",adminOnly,(req,res)=>{
 const status=clean(req.body?.status,30);
 if(!["New","Contacted","Approved","Rejected"].includes(status)) return res.status(400).json({error:"Invalid status."});
 const r=db.prepare("UPDATE partners SET status=? WHERE id=?").run(status,Number(req.params.id));
 res.json({ok:r.changes>0});
});
app.post("/api/admin/cars",adminOnly,(req,res)=>{
 const c=req.body||{},name=clean(c.name,100),category=clean(c.category,60);
 if(!name||!category)return res.status(400).json({error:"Car name and category are required."});
 const r=db.prepare(`INSERT INTO cars(name,category,seats,transmission,fuel,self_drive_price,with_driver_price,image_url,description)
 VALUES(?,?,?,?,?,?,?,?,?)`).run(name,category,Number(c.seats)||5,clean(c.transmission,30)||"Manual",clean(c.fuel,30)||"Petrol",
 Math.max(0,Number(c.selfDrivePrice)||0),Math.max(0,Number(c.withDriverPrice)||0),clean(c.imageUrl,500),clean(c.description,300));
 res.status(201).json({ok:true,id:r.lastInsertRowid});
});
app.patch("/api/admin/cars/:id",adminOnly,(req,res)=>{
 const c=req.body||{};
 if(typeof c.active==="boolean"){
  const r=db.prepare("UPDATE cars SET active=? WHERE id=?").run(c.active?1:0,Number(req.params.id));return res.json({ok:r.changes>0});
 }
 const r=db.prepare(`UPDATE cars SET name=?,category=?,seats=?,transmission=?,fuel=?,self_drive_price=?,with_driver_price=?,image_url=?,description=? WHERE id=?`)
 .run(clean(c.name,100),clean(c.category,60),Number(c.seats)||5,clean(c.transmission,30),clean(c.fuel,30),
 Math.max(0,Number(c.selfDrivePrice)||0),Math.max(0,Number(c.withDriverPrice)||0),clean(c.imageUrl,500),clean(c.description,300),Number(req.params.id));
 res.json({ok:r.changes>0});
});
// ADD-ON 2: BOOKING LOCK
app.patch("/api/admin/bookings/:id", adminOnly, (req,res)=>{
  const b = db.prepare("SELECT * FROM bookings WHERE id=?").get(req.params.id);
  if(!b) return res.status(404).json({error:"Booking not found"});
  if(b.status !== 'NEW' && b.status !== 'PENDING' && b.status !== ''){
    return res.status(403).json({error:"🔒 LOCKED - Already " + b.status});
  }
  let who = req.session.adminUser === "4wheelsShashank" ? "Shashank" : req.session.adminUser === "4wheelsSanu" ? "Sanu Pal" : "Boss Anand";
  let newStatus = req.body.status + " by " + who;
  db.prepare("UPDATE bookings SET status=? WHERE id=?").run(newStatus, req.params.id);
  res.json({ok:true});
});

// ADD-ON 3: OTP - 9140518693
app.post("/api/admin/forgot-password", async (req,res)=>{
  let phone = String(req.body.phone).replace(/\D/g,'').slice(-10);
  if(phone !== "9140518693") return res.status(403).json({error:"This number is not registered as Admin"});
  let otp = Math.floor(100000 + Math.random()*900000);
  otpStore[phone] = {otp, time: Date.now()};
  console.log(`\n🔑 OTP for ${phone} : ${otp}\n`);
  res.json({ok:true, message:"OTP sent successfully"});
});
app.post("/api/admin/reset-password", (req,res)=>{
  let phone = String(req.body.phone).replace(/\D/g,'').slice(-10);
  let saved = otpStore[phone];
  if(!saved) return res.status(400).json({error:"Please request OTP first"});
  if(Date.now() - saved.time > 5*60*1000) return res.status(400).json({error:"OTP Expired"});
  if(String(saved.otp) !== String(req.body.otp)) return res.status(400).json({error:"Invalid OTP"});
  ADMINS["4wheelsAnand"] = req.body.newPassword;
  delete otpStore[phone];
  res.json({ok:true, message:"Password changed successfully"});
});
app.post("/api/admin/login", (req,res)=>{
  const {username, password} = req.body;
  if(ADMINS[username] && ADMINS[username] === password){
    req.session.isAdmin = true;
    req.session.adminUser = username;
    return res.json({ok:true});
  }
  return res.status(401).json({error:"Wrong Username or Password"});
});
app.use(express.static(path.join(__dirname,"public")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`4Wheels API + website listening on port ${PORT}`));
