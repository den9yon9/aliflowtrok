/** @jsxRuntime automatic */
/** @jsxImportSource npm:preact@10.25.4 */

import hub from "jsr:@trok/trok@0.1.42/hub";
import { basename } from "jsr:@std/path@^1.0.8";
import { render } from "npm:preact-render-to-string@^6.5.12";
import { extname, resolve } from "jsr:@std/path@1.0.8";

type Flow = {
  origin: string;
  branch: string;
  host: string[];
  webhook: string;
  notify: string;
};

type FlowTask = {
  origin: string;
  branch: string;
  selector: string;
  from: string;
};

type GithubWebhookBody = {
  ref: string;
  compare: string;
  repository: { html_url: string };
  sender: { login: string };
};

type FlowWebhookBody = {
  errorCode: string;
  errorMsg: string;
  successful: false;
} | {
  object: true;
  successful: true;
};

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=UTF-8" },
    status,
  });
}

function html(jsxElement: preact.JSX.Element) {
  return new Response(
    render(<Document>{jsxElement}</Document>),
    { headers: { "content-type": "text/html; charset=UTF-8" } },
  );
}

let flows: Flow[] = [];

if (Deno.env.has("FLOWS_URL")) {
  flows = await fetch(Deno.env.get("FLOWS_URL")!).then((res) =>
    res.json()
  ) as Flow[];
} else {
  try {
    const data = Deno.readFileSync(resolve(Deno.cwd(), "flows.json"));
    const text = new TextDecoder().decode(data);
    flows = JSON.parse(text);
  } catch (err) {
    console.error(`未找到流水线配置文件`, (err as Error).message);
    throw err;
  }
}

export function isSameGitOrigin(a: string, b: string) {
  const removeExtname = (pathname: string) =>
    pathname.replace(extname(pathname), "");

  const parseGitOrigin = (origin: string) => {
    let cookedOrigin = origin;
    // 补全转换scp形式的origin
    if (origin.startsWith("git@")) {
      cookedOrigin = `ssh://${origin.replace(":", "/")}`;
    }
    return new URL(cookedOrigin);
  };

  const [urlA, urlB] = [a, b].map(parseGitOrigin);
  return urlA.host === urlB.host &&
    removeExtname(urlA.pathname) === removeExtname(urlB.pathname);
}

async function dispatch(task: FlowTask) {
  const flow = flows.find((item) => {
    return isSameGitOrigin(item.origin, task.origin) &&
      item.branch === task.branch;
  });
  if (!flow) return new Response("未找到此仓库或分支的流水线", { status: 404 });
  const res = await fetch(flow.webhook, {
    method: "POST",
    body: JSON.stringify({ selector: task.selector, notify: flow.notify, from: task.from }),
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json() as FlowWebhookBody;
  if (data.successful) return html(<Success />);
  return json(data);
}

export default {
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);

    switch (`${req.method} ${pathname}`) {
      case "GET /flows/": {
        return html(<Flows />);
      }

      case "POST /dispatch": {
        const text = await req.text();
        const search = new URLSearchParams(text);
        return await dispatch({
          origin: search.get("origin")!,
          branch: search.get("branch")!,
          selector: search.get("selector")!,
          from: "@trok/aliflow.ui",
        });
      }

      case "POST /github": {
        const data = await req.json() as GithubWebhookBody;
        const origin = data.repository.html_url;
        const branch = basename(data.ref);
        const selector = basename(data.compare);
        return await dispatch({ origin, branch, selector, from: `@trok/aliflow.github.${data.sender.login}` });
      }

      default:
        return await hub.fetch(req);
    }
  },
};

function Document(props: { children: preact.JSX.Element }) {
  return (
    <html>
      <head>
        <link
          href="https://cdn.jsdelivr.net/npm/daisyui@4.12.23/dist/full.min.css"
          rel="stylesheet"
          type="text/css"
        />
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>{props.children}</body>
    </html>
  );
}

function Flows() {
  return (
    <div className="w-screen bg-base-300 flex">
      <div className="flex flex-col gap-2 w-96 h-screen overflow-y-scroll p-5">
        {flows.map((item) => {
          return (
            <form
              method="post"
              action="../dispatch"
              key={`${item.origin}/${item.branch}`}
              className="shadow bg-base-100 rounded-2xl p-5 flex flex-col gap-2 border-primary"
            >
              <div>
                {item.origin}
                <span className="badge badge-outline ml-2 badge-sm">
                  {item.branch}
                </span>
              </div>
              <input type="hidden" name="origin" value={item.origin} />
              <input type="hidden" name="branch" value={item.branch} />
              <input
                required
                type="text"
                name="selector"
                className="input input-bordered input-sm"
                placeholder="eg: ./act/act-center"
              />
              <button class="btn btn-primary btn-sm">提交打包任务</button>
            </form>
          );
        })}
      </div>
      <iframe
        id="trok"
        src=".."
        className="w-2/3 h-screen overflow-y-scroll grow bg-base-100 p-5"
      >
      </iframe>
    </div>
  );
}

function Success() {
  return (
    <div className="w-screen">
      <p>任务提交成功</p>
      <a className="btn btn-primary" href="./flows/">
        回到首页
      </a>
    </div>
  );
}
