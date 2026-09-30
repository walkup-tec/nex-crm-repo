<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## NEX Ads architecture
- Keep domain seed data outside UI components so demo content can be replaced by live integrations cleanly.
- Keep Meta, Asaas, and EVO behind server-side service interfaces; external credentials never enter browser code.
- Store roles separately from profiles and enforce tenant access in database policies and authenticated server functions.
- Use the supplied NEX Marketing Digital artwork as the canonical static brand asset; it keeps the product visually consistent.
