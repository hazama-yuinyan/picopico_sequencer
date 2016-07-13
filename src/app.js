var http = require("http"), url = require("url"), path = require("path"), fs = require("fs");

http.createServer(function(req, res){
	if(req.method != "GET")
		return;

	var uri = url.parse(req.url).pathname;
	var file_name = path.join(process.cwd(), uri);
	var match = file_name.match(/\.([a-z0-9]+)$/), content_type;
	if(match){
		var ext = match[1];
		switch(ext){
		case "html":
			content_type = "text/html";
			break;

		case "css":
			content_type = "text/css";
			break;

		case "js":
			content_type = "text/javascript";
			break;

		case "ogg":
			content_type = "audio/ogg";
			break;

		case "wav":
			content_type = "audio/wav";
			break;

		case "mp3":
			content_type = "audio/mpeg";
			break;

		case "png":
			content_type = "image/png";
			break;

		case "jpg":
			content_type = "image/jpeg";
			break;

		case "gif":
			content_type = "image/gif";
			break;

		case "xml":
			content_type = "text/xml";
			break;

		case "svg":
			content_type = "image/svg+xml";
			break;

		case "json":
			content_type = "application/json";
			break;

		default:
			console.log("Unknown file extension!; " + ext);
			res.writeHead(404, {"Content-Type" : "text/plain"});
			res.write("Unknown file extension!\n");
			res.end();
			return;
		}
	}else{
		content_type = "text/html";
	}

	if(fs.statSync(file_name).isDirectory())
		file_name += "/index.html";

	fs.readFile(file_name, function(err, data){
		if(err){
			res.writeHead(500, {"Content-Type" : "text/plain"});
			res.write(err + "\n");
			res.end();
		}else{
			res.writeHead(200, {"Content-Type" : content_type});
			res.write(data);
			res.end();
		}
	});
}).listen(8080, "localhost");

console.log("Server running at localhost:8080");
