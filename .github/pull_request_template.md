## Summary

Describe the change and the user-facing or operational behavior it affects.

Use a Conventional Commit title, for example `fix: correct logout redirect`
or `feat: allow editing definitions`.

## Validation

- [ ] `pnpm run verify`
- [ ] `pnpm run security:check`
- [ ] `pnpm test:e2e` when browser or authentication behavior changed
- [ ] `pnpm run test:container` when container behavior changed

## Delivery

- [ ] Changes are committed on a focused branch and pushed
- [ ] Required pull request checks have passed
- [ ] The pull request is ready to squash-merge

## Notes

Call out migrations, configuration changes, security considerations, and
follow-up work.
