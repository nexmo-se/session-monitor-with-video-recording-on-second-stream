console.log("Starting Session Monitor Demo")
require('dotenv').config()
const join = require('path').join;
const express = require('express');
const app = express();
const server = require('http').createServer();
const port = process.env.PORT || 3003;
const OpenTok = require("opentok");
const { MongoClient } = require("mongodb");
const OPENTOK_KEY = process.env.OPENTOK_KEY
const OPENTOK_SECRET = process.env.OPENTOK_SECRET
const EXPIRY_FOR_RESULTS = "30" //days
const opentok = new OpenTok(OPENTOK_KEY, OPENTOK_SECRET);
const uri = process.env.MONGODB_URI||"mongodb://127.0.0.1";
const client = new MongoClient(uri);

const database = client.db('session-monitor');
const sessions = database.collection('sessions');
const project_ids = database.collection('project_ids');


var morgan = require('morgan')
var timeout = require('connect-timeout')
const findKeyValue = (obj, key, val) =>
  Object.keys(obj).filter(k => obj[key] === val && k === key);

const connectionCreated = async (data) => {
  var obj = {
    sessionId: "",
    name: "",
    projectId: "",
    timestamp: "",
    connections: [],
    connection_count: 0,
    streams: [],
    stream_count: 0,
    archive: {status: "Not Available"}
  }
  current_obj = await sessions.findOne({"sessionId": data.sessionId})
  if (!current_obj) {
    obj.sessionId = data.sessionId
    obj.name = data.name
    obj.projectId = data.projectId
    obj.timestamp = data.timestamp
    obj.connections.push(data.connection)
    obj.connection_count = obj.connections.length
    await sessions.updateOne(
      {"sessionId":obj.sessionId},
      {'$set':obj},
      {upsert: true}
    )
  } else {    
    current_obj.connections.push(data.connection)
    current_obj.connection_count = current_obj.connections.length
    await sessions.updateOne(
      {"sessionId":current_obj.sessionId},
      {'$set':current_obj},
      {upsert: true}
    )
  }
  const isExistingProjectId = await project_ids.findOne({"projectId": data.projectId})
  if(!isExistingProjectId){
    to_insert = {"projectId":data.projectId, "name":""}
    await project_ids.insertOne(to_insert)
  }
  return obj
}

const connectionDestroyed = async (data) => {
  var obj = {
    sessionId: "",
    name: "",
    projectId: "",
    timestamp: "",
    connections: [],
    connection_count: 0,
    streams: [],
    stream_count: 0,
    archive: {status: "Not Available"}
  }
  current_obj = await sessions.findOne({"sessionId": data.sessionId})
  if (!current_obj) {
    return
  } else {
  
    found = current_obj.connections.findIndex((e) => e.id == data.connection.id)
    current_obj.connections.splice(found, 1)
    current_obj.connection_count = current_obj.connections.length
    await sessions.updateOne(
      {"sessionId":current_obj.sessionId},
      {'$set':current_obj},
      {upsert: true}
    )
  }
  return obj
}

const streamCreated = async (data) => {
  var obj = {
    sessionId: "",
    name: "",
    projectId: "",
    timestamp: "",
    connections: [],
    connection_count: 0,
    streams: [],
    stream_count: 0,    
    archive: {status: "Not Available"}
  }
  current_obj = await sessions.findOne({"sessionId": data.sessionId})
  if (!current_obj) {
    obj.sessionId = data.sessionId
    obj.name = data.name
    obj.projectId = data.projectId
    obj.timestamp = data.timestamp
    obj.streams.push(data.stream)
    obj.stream_count = obj.streams.length
    await sessions.updateOne(
      {"sessionId":obj.sessionId},
      {'$set':obj},
      {upsert: true}
    )
    return obj
  } else {
    current_obj.streams.push(data.stream)
    current_obj.stream_count = current_obj.streams.length
    if(current_obj.stream_count >=2 && current_obj.archive.status ==  "Not Available"){
      console.log(">>>>>> ARCHIVING")
      await opentok.startArchive(current_obj.sessionId, {name: current_obj.sessionId+"_recording"}, async (err, archive)=>{
        if(err){
          console.log(">>>>ERROR",err)
          await sessions.updateOne(
            {"sessionId":current_obj.sessionId},
            {'$set':current_obj},
            {upsert: true}
          )
        }
        console.log("ARCH", archive)
        current_obj.archive = archive
        await sessions.updateOne(
          {"sessionId":current_obj.sessionId},
          {'$set':current_obj},
          {upsert: true}
        )
      })
    }else{
      await sessions.updateOne(
        {"sessionId":current_obj.sessionId},
        {'$set':current_obj},
        {upsert: true}
      )
    }
    return current_obj
  }
  
}

const streamDestroyed = async (data) => {
  var obj = {
    sessionId: "",
    projectId: "",
    projectName: "",
    connections: [],
    connection_count: 0,
    streams: [],
    stream_count: 0,
    archive: {status: "Not Available"}
  }
  current_obj = await sessions.findOne({"sessionId": data.sessionId})
  if (!current_obj) {
    return
  } else {
    found = current_obj.streams.findIndex((e) => e.id == data.stream.id)
    console.log("Found it", found)
    current_obj.streams.splice(found, 1)
    current_obj.stream_count = current_obj.streams.length
    await sessions.updateOne(
      {"sessionId":current_obj.sessionId},
      {'$set':current_obj},
      {upsert: true}
    )
  }
  return obj
}

const getStreams = async (callback, options={sessionId:undefined, projectId:undefined, streamName:undefined, count:-1, op:">"}) => {
  if(options.sessionId!=undefined || options.projectId!=undefined || options.streamName!=undefined || options.count>-1 ){    
    
    //create the fitlering query. Using Strings and eval here so we don't have to deal with Regex
    var q = "(async () => {result = await sessions.find({$and:["
    if(options.sessionId!=undefined){
      q+= `{$or:[{'sessionId':'${options.sessionId}'}, {'name':'${options.sessionId}'}]},`
    }
    if(options.projectId!=undefined){
      q+= `{$or:[{'projectId':'${options.projectId}'}, {'projectName':'${options.projectId}'}]},`
    }
    if(options.streamName!=undefined){
      q+=`{'streams.streamName':'${options.streamName}'},`
    }
    q+=`{'stream_count':${operators[options.op](options.count)}}]}).toArray(); callback(result); return})()`    
    //Run the mongoDB query
    eval(q)
  }else{
    result = await sessions.find().toArray()
    callback(result)
  } 
}

var operators = {
  '>': function (a) { return "{$gt: "+ a +"}" },
  '<': function (a) { return "{$lt: "+ a +"}" },
  '>=': function (a) { return "{$gte: "+ a +"}" },
  '<=': function (a) { return "{$lte: "+ a +"}" },
  '==': function (a) { return "{$eq: "+ a +"}" },
  '!=': function (a) { return "{$ne: "+ a +"}"},
  '===': function (a) { return "{$eq: "+ a +"}" },
  // ...
};

app.use("/bootstrap", express.static(join(__dirname, '/node_modules/bootstrap/dist')));
app.use("/jquery", express.static(join(__dirname, "node_modules/jquery/dist/")));
app.use("/css", express.static(join(__dirname, "views/css")));
app.use("/js", express.static(join(__dirname, "views/js")));

app.use(timeout(process.env.RESPONSE_TIMEOUT || "30s"))
app.use(morgan('combined'))
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/set_session_name', async (req, res) => {
  var sessionId = req.query.sessionid
  if (!sessionId) res.headersSent?'':res.status(200).json("param sessionid cannot be empty");
  var name = req.query.name 
  if (!name) res.headersSent?'':res.status(200).json("param name cannot be empty");
  current_obj = await sessions.findOne({"sessionId": sessionId})
  if (!current_obj) res.headersSent?'':res.status(200).json("Session Not found");
  if (res.headersSent) return
  current_obj.name = decodeURIComponent(name)
  await sessions.updateOne(
    {"sessionId":sessionId},
    {"$set":current_obj},
    {upsert: true}
  )   
  res.status(200).json({session:sessionId, name: name});
  return
});

app.get('/set_project_id_name', async (req, res) => {
  var projectId = req.query.projectid
  if (!projectId) res.headersSent?'':res.status(200).json("param projectid cannot be empty");
  var name = req.query.name 
  if (!name) res.headersSent?'':res.status(200).json("param name cannot be empty");
  if(name=="_") name = ''
  const existingProjectId = await project_ids.findOne({"projectId": projectId})
  if (!existingProjectId) res.headersSent?'':res.status(200).json("projectid Not found");
  if (res.headersSent) return

  existingProjectId.name =  decodeURIComponent(name)
  await projects.updateOne(
    {"projectId":projectId},
    {"$set":existingProjectId},
    {upsert: true}
  )   
  res.status(200).json({ProjectId:projectId, name: name});

  return

});

app.post('/session_monitor', async (req, res) => {
  console.log("Session Monitor Params Received:\n", req.body)
  if (req.body.event == "connectionCreated") {
    connectionCreated(req.body)
  } else if (req.body.event == "connectionDestroyed") {
    connectionDestroyed(req.body)
  } else if (req.body.event == "streamCreated") {
    streamCreated(req.body)
  } else if (req.body.event == "streamDestroyed") {
    streamDestroyed(req.body)
  }
  res.status(200).json(req.query);
});

app.get('/', async (req, res) => {
  const vals = await project_ids.find().toArray()
  console.log(vals)
  getStreams((result) => {
    console.log(">>>>", result, vals)   
    res.render('cards.ejs', { data: result, projects: vals });
  })
});

app.get('/_/health', async (req, res) => {
  res.status(200).json("I'm alive!")
});

app.get('/webhooks/recording', async (req, res) => {
  console.log("Recording LOG GET")
  console.dir(req.query)
  res.status(200).json("ok")
});

app.post('/webhooks/recording', async (req, res) => {
  console.log("Recording LOG POST")
  console.dir(req.body)
  res.status(200).json("ok")
});

app.get('/get_all', async (req, res) => {
  var streamcount = req.query.streamcount || -1
  var streamcountoperator = req.query.streamcountoperator || ">="
  var streamname = req.query.streamname || undefined
  var sessionIDorName = req.query.sessionname || undefined
  var projectIDorName = req.query.projectname || undefined
  var streamcount = req.query.streamcount || -1
  getStreams(async (data) => {

    if (data.length == 0)
      res.status(200).json("empty");
    else { 
      
      //This code will update the archive status for the NEXT poll and not this one
      for await (const dat of data) {      
        if(dat.archive == undefined) continue
        if(dat.archive.status!="Not Available"){
          
          await opentok.getArchive(dat.archive.id, async (err, archive)=>{

            if(err){
              console.log(">>>ERRR!!!", err)
            }
            dat.archive = archive
            await sessions.updateOne(
              {"sessionId":dat.sessionId},
              {'$set':dat},
              {upsert: true}
            )           
          })
          
        }else{
          console.log("NOT AVAILABLE")
        }
      }
      data.sort(function(x, y){
        return y.timestamp - x.timestamp;
      })
      res.status(200).json(data); 
    }
  }, {sessionId:sessionIDorName, projectId: projectIDorName, streamName: streamname, count: streamcount, op: streamcountoperator })
});


server.on('request', app)
server.listen(port, async () => {
  console.log(`Starting server at port: ${port}`)
});