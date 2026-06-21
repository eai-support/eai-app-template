# Deploy an EAI App Anywhere

EAI apps use a provider-neutral runtime contract in `eai.runtime.json`. Hosting
providers should translate the contract into their own environment variables,
secrets, callback URLs, and smoke checks; the app code should not depend on a
specific host.

## Required Runtime Capabilities

- Auth.js with Microsoft Entra sign-in
- PublicAPI access through the app BFF at `/api/eai`
- tenant and workflow configuration from `/api/eai/config`
- `/health` for host liveness
- optional service identity for server-side PublicAPI calls without an end-user
  session
- declared smoke tests that prove the app is usable, not only running

## Validate Locally

```bash
eai runtime validate
eai deploy env --provider generic
```

`eai runtime validate` checks that required env names and secrets are declared,
tenant/workflow keys are consistent, Auth.js callback paths are valid, public
endpoints are listed, and service identity requirements are explicit.

## Validate After Deploy

```bash
eai deploy doctor --url https://your-app.example.com
```

The deploy doctor checks `/health`, `/api/auth/providers`,
`/api/eai/config`, declared public endpoints, declared smoke tests, and the
app's BFF/runtime reachability. It classifies failures as host/infrastructure,
app not running, Auth.js config, Entra callback config, PublicAPI config,
tenant/workflow config, service identity config, PublicAPI authorization, or app
runtime errors.

## Provider Examples

- Vercel: add required env vars in project settings, add required secrets as
  encrypted environment variables, then run deploy doctor against the preview
  and production URLs.
- Docker: provide env vars with `--env-file` or orchestrator secrets, expose the
  app port, then run deploy doctor against the container URL.
- AWS or Azure: map env vars to the app service/container environment and
  secrets to the platform secret store.
- Kubernetes: put non-secret env vars in a ConfigMap, secrets in a Secret, mount
  both into the workload, then run deploy doctor against the ingress URL.
- VM or internal demo host: provide the same environment contract through the
  host process manager and run the same doctor command.

For app-only PublicAPI access, prefer `EAI_SERVICE_CLIENT_ID`,
`EAI_SERVICE_CLIENT_SECRET`, `EAI_SERVICE_TARGET_SCOPE`, and
`EAI_SERVICE_TENANT_NAME`. Existing `OBO_*` aliases remain supported for
backward compatibility.
