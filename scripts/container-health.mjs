import http from 'node:http';
const host=process.env.CAMPUS_PUBLIC_ORIGIN?new URL(process.env.CAMPUS_PUBLIC_ORIGIN).host:`127.0.0.1:${process.env.PORT||8765}`;
const request=http.get({hostname:'127.0.0.1',port:Number(process.env.PORT||8765),path:'/api/v1/health',headers:{Host:host}},response=>{let body='';response.on('data',chunk=>body+=chunk);response.on('end',()=>{try{const result=JSON.parse(body);process.exitCode=response.statusCode===200&&result.data?.status==='ok'?0:1;}catch{process.exitCode=1;}});});
request.setTimeout(3000,()=>request.destroy(new Error('Health request timed out.')));request.on('error',()=>{process.exitCode=1;});
