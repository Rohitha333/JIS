const express=require('express');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const path = require('path');
const methodOverride = require('method-override');
const MongoStore = require('connect-mongo');
const bcrypt=require('bcrypt');
const dotenv=require('dotenv');
const jwt=require('jsonwebtoken');

dotenv.config();


if (typeof localStorage === "undefined" || localStorage === null) {
    var LocalStorage = require('node-localstorage').LocalStorage;
    localStorage = new LocalStorage('./scratch');
}

const SECRET_KEY=process.env.SECRET_KEY;


const Case=require('./models/case');
const User=require('./models/user');
const Session = require('./models/session');
const { request } = require('http');

mongoose.connect(process.env.DBURL).then(()=>{
    console.log("db connected");
})

// localStorage.setItem('loggedby',"");
localStorage.setItem('loggedby_token',"");

const app=express();


app.set('view engine','ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/',async(req,res)=>{
    if(localStorage.getItem('loggedby_token')==""){
       return res.redirect('/signin');
    }
   var loggedinusername=jwt.verify(localStorage.getItem('loggedby_token'),'bhkdgrhikkghje');
    const current=await User.findOne({username:loggedinusername});
    const lawer=false;
   const cur=await Case.find();
   if(current.isLawer || current.isJudge){
    res.render("lawer",{cur:cur,due:current.due,current:current});
   }
   else{
    res.render("home",{lawer:lawer,current:current});
   }
})

app.get("/about",(req,res)=>{
    var current="";
    console.log(localStorage.getItem('loggedby_token'));
    var token=localStorage.getItem('loggedby_token');
    if(token)  current=jwt.verify(localStorage.getItem('loggedby_token'),'bhkdgrhikkghje');
    return res.render("about",{current:current});
})

app.get('/pastcases', async(req,res)=>{
    if(localStorage.getItem('loggedby_token')==""){
       return res.redirect('/signin');
    }
    const current=await User.findOne({username:jwt.verify(localStorage.getItem('loggedby_token'),'bhkdgrhikkghje')});
    const cur=await Case.find({closed:true});
    res.render("cases",{cur:cur,current:current});
})

app.get('/activecases', async(req,res)=>{
    if(localStorage.getItem('loggedby_token')==""){
       return res.redirect('/signin');
    }
    const current=await User.findOne({username:jwt.verify(localStorage.getItem('loggedby_token'),'bhkdgrhikkghje')});
    const cur=await Case.find({closed:false});
    var cases=[];
    for(let i=0;i<cur.length;i++){
        var today=new Date();
        if(cur[i].dateOfHearing.getDate()==today.getDate() && cur[i].dateOfHearing.getMonth()==today.getMonth() &&
        cur[i].dateOfHearing.getYear()==today.getYear())
        {
            cases.push(cur[i]);
        }
    }
    res.render("cases",{cur:cases,current:current});
})

app.get('/upcomingcases',async(req,res)=>{
    if(localStorage.getItem('loggedby_token')==""){
       return res.redirect('/signin');
    }
    const cur=await Case.find({closed:false});
    var cases=[];
    const current=await User.findOne({username:jwt.verify(localStorage.getItem('loggedby_token'),'bhkdgrhikkghje')});
    for(let i=0;i<cur.length;i++){
        var today=new Date();
        if(cur[i].dateOfHearing.getDate()==today.getDate() && cur[i].dateOfHearing.getMonth()==today.getMonth() &&
        cur[i].dateOfHearing.getYear()==today.getYear())
        {
          continue;
        }
        else {
            cases.push(cur[i]);
        }
    }
    res.render("cases",{cur:cases,current:current});
})

app.get('/allcases',async(req,res)=>{
    if(localStorage.getItem('loggedby_token')==""){
       return res.redirect('/signin');
    }
    const current=await User.findOne({username:jwt.verify(localStorage.getItem('loggedby_token'),'bhkdgrhikkghje')});
    const cur=await Case.find();
    res.render("cases",{cur:cur,current:current});
})

app.get('/addcase', async(req,res)=>{
    if(localStorage.getItem('loggedby_token')==""){
        return res.redirect('/signin');
    }
    var loggedinusername=jwt.verify(localStorage.getItem('loggedby_token'),'bhkdgrhikkghje');
    const exist=await User.findOne({username:loggedinusername});
    if(exist.isRegistrer==false){
        return res.redirect('/');
    }
    if(localStorage.getItem('loggedby_token')==""){
       return res.redirect('/signin');
    }
    res.render("addcase",{error:""});
})

app.get('/signin',(req,res)=>{
    if(localStorage.getItem('loggedby_token')!=""){
        return res.redirect('/');
    }
    res.render("signin",{error:""});
})

app.get('/signup',(req,res)=>{
    if(localStorage.getItem('loggedby_token')!=""){
        return res.redirect('/');
    }
    res.render("signup",{errors:""});
})

app.post('/signup',async(req,res)=>{
    const { email, username,secretkey, password, confirmPassword } = req.body;
    var errors=[];
    if (!username || !email || !secretkey || !confirmPassword || !password) {
        errors.push("Please Enter all Fields")
        res.render('signup',{errors:errors});
    }
    else if(email.substring(email.length-10,email.length)!="@gmail.com" && email.substring(email.length-10,email.length)!="@yahoo.com" && email.substring(email.length-13,email.length)!="@iitism.ac.in" && email.substring(email.length-12,email.length)!="@outlook.com"){
        errors.push("Enter a valid email address");
        res.render('signup',{errors:errors});
    }
    else if(secretkey!=SECRET_KEY){
        errors.push("Enter a valid Secret Key");
        res.render('signup',{errors:errors});
    }
    else if (password != confirmPassword) {
        errors.push("Password and Confirm password doesn't match");
        res.render('signup',{errors:errors});
    }
    else if (password.length < 6) {
        errors.push("Password must contain minimum 6 characters");
        res.render('signup',{errors:errors});
    }
    else {
        try {
            const newuser = new User({ email, username,password });
            const exist=await User.findOne({email});
            if(!exist) {
                newuser.save();
                res.redirect('/signin');
            }
            else {
                res.redirect('/signup');
            } 
        } catch (e) {
            res.redirect('/signup');
        }
    }
})

app.post('/signin', async(req,res)=>{
    const { username, password } = req.body;
    var loggedinusername=req.body.username;
    const exist=await User.findOne({username});
    if(!exist){
        res.render('signin',{error:"User Doesn't Exist"});
    }
    else if(exist.password!=password){
        res.render('signin',{error:"Incorrect Password"});
    }
    else {
      //  localStorage.setItem('loggedby',req.body.username);
        const gentoken=jwt.sign(req.body.username,'bhkdgrhikkghje');
        console.log(gentoken);
        localStorage.setItem('loggedby_token',gentoken);
        console.log(localStorage.getItem('loggedby_token'));
        res.redirect("/");
    }
})

app.get('/signout',(req,res)=>{
    localStorage.setItem('loggedby_token',"");
    res.redirect('/signin');
})



app.post('/addcase', async (req,res)=>{
    
   const {caseTitle,defendantName,defendantAddress,crimeType,committedDate,committedLocation,arrestingOfficer,dateOfArrest,presidingJudge,publicProsecutor,dateOfHearing,completionDate} = req.body;
   if(!caseTitle || !defendantName || !defendantAddress || !crimeType || !committedDate || !committedLocation || !arrestingOfficer || !dateOfArrest || !presidingJudge || !publicProsecutor || !dateOfHearing || !completionDate)
   {
      return res.render("addcase",{error:"Please Enter All Fields"})
   }
   const today=new Date();
   var td,tm;
   tm=today.getMonth()+1;
   if(today.getDate()<10) td = "0"+today.getDate();
   else td=today.getDate();
   if(tm<10) tm="0"+tm;
   else tm=today.getMonth();
   const todaysdate=""+today.getFullYear()+"-"+tm+"-"+td;
   if(committedDate>todaysdate){
    return res.render("addcase",{error:"Committed Date of Case Can't be in Future"});
   }
   if(dateOfArrest>todaysdate){
    return res.render("addcase",{error:"Date of Arrest Can't be in Future"});
   }
   if(dateOfArrest<committedDate){
    return res.render("addcase",{error:"Date of Arrest Can't be Earlier than Committed Date of Case"});
   }
   if(dateOfHearing<todaysdate){
    return res.render("addcase",{error:"Date of Hearing Can't be in Past"});
   }
   if(completionDate<todaysdate){
    return res.render("addcase",{error:"Expected Completion Date Can't be in Future"});
   }
   const db=await Case.find();
   const CIN=db.length+1;
   const newcase=new Case({
    caseTitle:caseTitle,
    defendantName:defendantName,
    defendantAddress:defendantAddress,
    crimeType:crimeType,
    committedDate:committedDate,
    committedLocation:committedLocation,
    arrestingOfficer:arrestingOfficer,
    dateOfArrest:dateOfArrest,
    presidingJudge:presidingJudge,
    publicProsecutor:publicProsecutor,
    dateOfHearing:dateOfHearing,
    completionDate:completionDate,
    CIN:CIN,
    closed:false
   });
   await newcase.save();
   res.redirect('/');
})

app.get('/case/:id', async (req, res) => {
    if(localStorage.getItem('loggedby_token')==""){
        return res.redirect('/signin');
    }
    var loggedinusername=jwt.verify(localStorage.getItem('loggedby_token'),'bhkdgrhikkghje')
    const exist=await User.findOne({username:loggedinusername});
    var isRegistrer=true;
    if(exist.isRegistrer==false){
         isRegistrer=false;
    }
    if(exist.isLawer==true){
        exist.due+=5;
        await exist.save();
    }
    const {id} = req.params;
    const currCase = await Case.findById(id).populate('sessions');
    // return res.send(currCase);
    return res.render('casedetails', {currCase:currCase,isRegistrer:isRegistrer,current:exist});

})

app.post('/case/:id/addSession', async (req, res) => {
    const id = req.params.id;
    const currCase = await Case.findById(id);
    const {attendingJudge, summary, nextHearingDate} = req.body;
    const newSession = new Session({attendingJudge, summary, nextHearingDate});
    await newSession.save();
    currCase.sessions.push(newSession.id);
    await currCase.save();    
    return res.redirect('/');
})

app.post('/case/:id/closeCase',async(req,res)=>{
    if(localStorage.getItem('loggedby_token')==""){
        return res.redirect('/signin');
    }
    const id=req.params.id;
    const curcase=await Case.findById(id);
    curcase.closed=true;
    await curcase.save();
    return res.redirect('/');
})

app.post('/addjudge',async(req,res)=>{
    if(localStorage.getItem('loggedby_token')==""){
        return res.redirect('/signin');
    }
    const adder=jwt.verify(localStorage.getItem('loggedby_token'),'bhkdgrhikkghje');
    const adderdetails=await User.findOne({username:adder});
    if(adderdetails.isRegistrer==false){
        return res.redirect('/');
    }
    const {emailJudge,userNameJudge,passwordJudge}=req.body;
    const exist=await User.findOne({username:userNameJudge});
    if(!exist) {
        const newuser= new User({
            email:emailJudge,
            username: userNameJudge,
            password: passwordJudge,
            isRegistrer:false,
            isJudge:true,
            isLawer:false,
            due:0
        })
        await newuser.save();
    }
    res.redirect('/');
})

app.post('/addlawer',async(req,res)=>{
    if(localStorage.getItem('loggedby_token')==""){
        return res.redirect('/signin');
    }
    const adder=jwt.verify(localStorage.getItem('loggedby_token'),'bhkdgrhikkghje');
    const adderdetails=await User.findOne({username:adder});
    if(adderdetails.isRegistrer==false){
        return res.redirect('/');
    }
    const {emailLawyer,userNameLawyer,passwordLawyer}=req.body;
    const exist=await User.findOne({username:userNameLawyer});
    if(!exist) {
        const newuser= new User({
            email:emailLawyer,
            username: userNameLawyer,
            password: passwordLawyer,
            isRegistrer:false,
            isJudge:false,
            isLawer:true,
            due:0
        })
        await newuser.save();
    }
    res.redirect('/');
})

app.get('/changepassword',async(req,res)=>{
    if(localStorage.getItem('loggedby_token')==""){
        return res.redirect('/signin');
    }
    const current=await User.findOne({username:jwt.verify(localStorage.getItem('loggedby_token'),'bhkdgrhikkghje')});
    var error=[];
        res.render("changePassword",{current:current,error:error});
})

app.post('/changepassword',async(req,res)=>{
    if(localStorage.getItem('loggedby_token')==""){
        return res.redirect('/signin');
    }
    const exist=await User.findOne({username:jwt.verify(localStorage.getItem('loggedby_token'),'bhkdgrhikkghje')})
    const error=[];
    if(req.body.currentPassword!=exist.password){
        error.push("Please Enter Valid Current Password");
        res.render('changePassword',{error:error,current:exist});
    }
    else if(req.body.newPassword.length<6){
        error.push("New Password Must be Atleast 6 Characters")
    }
    else if(req.body.newPassword!=req.body.confirmPassword){
        error.push("New Password and Confirm New Password Not Matching");
    }
    if(error.length>0){
       return res.render('changePassword',{error:error,current:exist});
    }
    exist.password=req.body.newPassword;
    exist.save(); 
    res.redirect('/');
})


app.use("*", (req, res) => {
    res.render("pageNotFound");
})


app.listen(9000,()=>{
    console.log("listening on port 9000....");
})
