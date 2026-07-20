import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.STORE_CONFIG || {};
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY);
const form = document.querySelector("#auth-form");
const message = document.querySelector("#message");
const submit = form.querySelector("[type=submit]");
const nameWrap = document.querySelector("#name-wrap");
let mode = "signin";

function setMode(next) {
  mode = next;
  document.querySelector("#signin-tab").classList.toggle("active", mode === "signin");
  document.querySelector("#signup-tab").classList.toggle("active", mode === "signup");
  nameWrap.hidden = mode !== "signup";
  submit.textContent = mode === "signin" ? "Sign in" : "Create account";
  document.querySelector("#password").autocomplete = mode === "signin" ? "current-password" : "new-password";
  message.textContent = "";
}

async function routeUser(user) {
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  location.replace(data?.role === "admin" ? "admin.html" : "account.html");
}

document.querySelector("#signin-tab").onclick = () => setMode("signin");
document.querySelector("#signup-tab").onclick = () => setMode("signup");
const { data: { session } } = await supabase.auth.getSession();
if (session) await routeUser(session.user);

form.onsubmit = async (event) => {
  event.preventDefault();
  submit.disabled = true;
  message.textContent = "";
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;
  if (mode === "signin") {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) message.textContent = error.message;
    else await routeUser(data.user);
  } else {
    const full_name = document.querySelector("#name").value.trim();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name } } });
    message.textContent = error ? error.message : data.session ? "Account created. Redirecting…" : "Check your email to confirm your account.";
    if (data.session) await routeUser(data.user);
  }
  submit.disabled = false;
};
