
# Session Monitor that records Sessions only when 2 or more streams are available.

  

A sample app that shows how to use Session Monitor to record when 2 or more users are streaming.

## Requirements
1. Tokbox Account
2. NodeJS (built on v20.4.0)
3. Mongo DB Server

## Code Configuration

1.  Populate `.env` with your **Port**,  **Opentok Key,** **Opentok Secret** and you **MongoDB connection string**


## Running

  

1.  `npm install`

2.  `node indes.js`

## Opentok Session Monitor Config

1. Follow the steps on setting your monitoring callback here
2. Use <current_URL>/session_monitor as your callback url

## Session Monitor Notes
- You can set project name via:

	    <current_URL>/set_project_id_name?projecttid=PROJECTID&name=NAMEYOUWANT

	if you set NAMEYOUWANT to _ (underscore), it will remove the name of the project

- To set session name you call:
 

      <current_URL>/set_session_name?sessionid=SESSIONID&name=NAMEYOUWANT

  

