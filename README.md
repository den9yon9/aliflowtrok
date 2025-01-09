服务部署:

1. 前往云效流水线编辑页面的触发设置里寻找流水线webhook地址,找到webhook地址后, 准备一个flows.json文件，json格式类型为:
```typescript
Array<{
    "origin": string,
    "branch": string,
    "webhook": string
}>
```

2. 准备一个空目录, 将上一步准备的flows.json转移到其中, 然后执行以下命令启动服务
```bash
pm2 start --name aliflow deno -- serve --port 3010 -A jsr:@trok/aliflow
```

3. 配置服务代理, 在nginx中反向代理将上一步启动的服务，nginx参考配置如下：
```nginx

map $http_upgrade $connection_upgrade {
    	default upgrade;
        ''      close;
}

server {

	# ... ...

	location ^~ /trok/ {
		proxy_pass http://localhost:8000/;
 		proxy_http_version 1.1;
        	proxy_set_header Host $host;
   		proxy_set_header Upgrade $http_upgrade;
        	proxy_set_header Connection $connection_upgrade;
	}

	# ... ...

}

```

4. 在云效率构建流程中设置构建脚本为:
```bash
yes | npx deno -A jsr:@trok/trok --selector $selector --notify ws://yourhost/kort/ --verbose && npx deno -A jsr:@trok/aliflow/deploy
```

5. 设置github触发，将你的服务的/flows/github路由设置到github的webhook的payload URL中，content-type选择application/json, 
触发方式选择just the push event, 勾选active后选择保存即可