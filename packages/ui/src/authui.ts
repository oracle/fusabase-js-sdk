// Copyright (c) 2015, 2025, Oracle and/or its affiliates.

//-----------------------------------------------------------------------------
//
// This software is dual-licensed to you under the Universal Permissive License
// (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
// 2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose
// either license.
//
// If you elect to accept the software under the Apache License, Version 2.0,
// the following applies:
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
//-----------------------------------------------------------------------------

// BaaS imports
import { initializeApp, App } from "../../app/src/index.js";
import { FusabaseOptions } from "../../app/src/public-types.js";
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut,
  Auth,
  FacebookAuthProvider,
  GithubAuthProvider,
  EmailAuthProvider,
  UserCredential,
  onAuthStateChanged,
  User
} from "../../auth/src/index.js";
import googleIcon from "./icons/web_neutral_rd_na.svg";
import facebookIcon from "./icons/Facebook_Logo_Secondary.png";
import githubIcon from "./icons/GitHub_Invertocat_White.svg";



interface AuthUIConfig {
  signInOptions?: string[];
  callbacks?: {
    signInSuccessWithAuthResult: (authResult: UserCredential, redirectUrl?: string | null) => boolean;
  };
  signInSuccessUrl?: string;
}

export const authUI: any = {
  AuthUI: class {
    private app?: App;
    private auth: Auth;

    constructor(appOrConfig: App | Auth | FusabaseOptions) {
      if (appOrConfig instanceof App) {
        this.app = appOrConfig;
        this.auth = getAuth(this.app);
      } else if (appOrConfig instanceof Auth) {
        this.auth = appOrConfig;
      } else {
        this.app = initializeApp(appOrConfig);
        this.auth = getAuth(this.app);
      }
    }

    start(containerId: string | HTMLElement, config: AuthUIConfig) {
      const container: HTMLElement | null = typeof containerId === 'string'
        ? document.querySelector(containerId)
        : containerId;

      if (!container) throw new Error("Container not found");

      // Inject styles
      const style: HTMLStyleElement = document.createElement("style");
      style.textContent = `
        #baasauthui-auth-wrapper {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          padding: 30px;
          width: 320px;
          font-family: system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;  /* center all child elements horizontally */
        }
        #baasauthui-auth-wrapper h2 {
          margin-top: 0;
          margin-bottom: 20px;
          text-align: center;
          color: #333;
        }
        #baasauthui-auth-wrapper input {
          width: 100%;
          max-width: 260px; /* prevents input from touching wrapper edges */
          padding: 10px;
          margin-top: 10px;
          border: 1px solid #ccc;
          border-radius: 8px;
          font-size: 14px;
        }
        #baasauthui-auth-wrapper button {
          width: 100%;
          max-width: 260px; /* buttons aligned with inputs */
          padding: 10px;
          margin-top: 12px;
          font-size: 14px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          background-color: #4A90E2;
          color: white;
        }
        #baasauthui-auth-wrapper button:hover {
          background-color: #3b7ccc;
        }
        #baasauthui-auth-wrapper .error {
          margin-top: 12px;
          color: #e74c3c;
          font-size: 13px;
          text-align: center;
        }
        #baasauthui-auth-wrapper .footer {
          margin-top: 20px;
          font-size: 12px;
          text-align: center;
          color: #999;
        }
      `;
      document.head.appendChild(style);

      container.innerHTML = '';

      const wrapper: HTMLDivElement = document.createElement("div");
      wrapper.id = "baasauthui-auth-wrapper";

      const title: HTMLHeadingElement = document.createElement("h2");
      title.innerText = "Sign In";
      wrapper.appendChild(title);

      const emailInput: HTMLInputElement = document.createElement("input");
      emailInput.type = "email";
      emailInput.placeholder = "Email";

      const passwordInput: HTMLInputElement = document.createElement("input");
      passwordInput.type = "password";
      passwordInput.placeholder = "Password";

      const loginBtn: HTMLButtonElement = document.createElement("button");
      loginBtn.innerText = "Login";

      const registerBtn: HTMLButtonElement = document.createElement("button");
      registerBtn.innerText = "Register";
      registerBtn.style.display = "none";

      const orDivider: HTMLDivElement = document.createElement("div");
      orDivider.style.width = "100%";
      orDivider.style.maxWidth = "260px";
      orDivider.style.height = "1px";
      orDivider.style.backgroundColor = "#ccc";
      orDivider.style.marginTop = "15px";
      orDivider.style.marginBottom = "0";
      orDivider.style.marginLeft = "auto";
      orDivider.style.marginRight = "auto";

      const toggleLink: HTMLDivElement = document.createElement("div");
      toggleLink.innerText = "Go to Signup";
      toggleLink.style.marginTop = "10px";
      toggleLink.style.color = "#4A90E2";
      toggleLink.style.cursor = "pointer";
      toggleLink.style.fontSize = "13px";
      toggleLink.style.textDecoration = "underline";

      // Add toggle functionality
      let isSignup: boolean = false;
      toggleLink.onclick = () => {
        isSignup = !isSignup;
        if (isSignup) {
          title.innerText = "Sign Up";
          loginBtn.style.display = "none";
          registerBtn.style.display = "block";
          toggleLink.innerText = "Go to Login";
        } else {
          title.innerText = "Sign In";
          loginBtn.style.display = "block";
          registerBtn.style.display = "none";
          toggleLink.innerText = "Go to Signup";
        }
      };

      const logoutBtn: HTMLButtonElement = document.createElement("button");
      logoutBtn.innerText = "Logout";
      logoutBtn.style.display = "none";

      const errorBox: HTMLDivElement = document.createElement("div");
      errorBox.className = "error";

      const box: HTMLDivElement = document.createElement("div");
      box.style.display = "flex";
      box.style.flexDirection = "column"; // stack vertically
      box.style.width = "100%";
      box.style.maxWidth = "260px"; // align with inputs
      box.style.gap = "10px";
      box.style.marginTop = "15px";

      // Helper function to create buttons
      function makeButton(provider: string, text: string, bgColor: string, textColor: string, logoUrl: any): HTMLButtonElement {
        const btn: HTMLButtonElement = document.createElement("button");
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center"; // center logo + text
        btn.style.gap = "12px";
        btn.style.padding = "10px 16px";
        btn.style.border = "none";
        btn.style.borderRadius = "4px";
        btn.style.cursor = "pointer";
        btn.style.fontSize = "14px";
        btn.style.fontWeight = "500";
        btn.style.color = textColor;
        btn.style.backgroundColor = bgColor;
        btn.style.width = "100%";
        btn.style.boxSizing = "border-box";
        btn.style.transition = "0.2s";
        btn.style.boxShadow = "0 2px 2px 0 rgba(0, 0, 0, .14), 0 3px 1px -2px rgba(0, 0, 0, .2), 0 1px 5px 0 rgba(0, 0, 0, .12)";

        // Logo
        const img: HTMLImageElement = document.createElement("img");
        img.src = logoUrl;
        img.alt = provider;
        img.style.width = "20px";
        img.style.height = "20px";

        // Text
        const span: HTMLSpanElement = document.createElement("span");
        span.innerText = `Sign in with ${text}`;

        btn.appendChild(img);
        btn.appendChild(span);

        // Hover effect (slightly darker bg)
        btn.addEventListener("mouseover", () => {
          btn.style.filter = "brightness(90%)";
        });
        btn.addEventListener("mouseout", () => {
          btn.style.filter = "brightness(100%)";
        });

        return btn;
      }

      // Create buttons
      const btnGoogle: HTMLButtonElement = makeButton(
        "Google",
        "Google",
        "#FFFFFF",   // white background
        "#000",   // black text
        googleIcon
      );

      const btnFacebook: HTMLButtonElement = makeButton(
        "Facebook",
        "Facebook",
        "#5890FF", // Facebook blue
        "#fff",    // white text
        facebookIcon
      );

      const btnGithub: HTMLButtonElement = makeButton(
        "GitHub",
        "GitHub",
        "#101411",   // GitHub dark gray/black
        "#fff",   // white text
        githubIcon
      );

      btnGoogle.onclick = async () => {
        try {
          const res: UserCredential = await signInWithPopup(this.auth, new GoogleAuthProvider());
          errorBox.textContent = "";
          let cRes: boolean = true;
          if (config && config.callbacks && config.callbacks.signInSuccessWithAuthResult) {
            let sUrl: string | null = null;
            if (config && config.signInSuccessUrl) {
              sUrl = config.signInSuccessUrl;
            }
            cRes = config.callbacks.signInSuccessWithAuthResult(res, sUrl);
          }
          if (cRes && config && config.signInSuccessUrl) {
            window.location.assign(config.signInSuccessUrl);
          }
        } catch (err) {
          errorBox.textContent = "Error! " + (err as Error).message;
        }
      };

      btnFacebook.onclick = async () => {
        try {
          const res: UserCredential = await signInWithPopup(this.auth, new FacebookAuthProvider());
          errorBox.textContent = "";
          let cRes: boolean = true;
          if (config && config.callbacks && config.callbacks.signInSuccessWithAuthResult) {
            let sUrl: string | null = null;
            if (config && config.signInSuccessUrl) {
              sUrl = config.signInSuccessUrl;
            }
            cRes = config.callbacks.signInSuccessWithAuthResult(res, sUrl);
          }
          if (cRes && config && config.signInSuccessUrl) {
            window.location.assign(config.signInSuccessUrl);
          }
        } catch (err) {
          errorBox.textContent = "Error! " + (err as Error).message;
        }
      };

      btnGithub.onclick = async () => {
        try {
          const res: UserCredential = await signInWithPopup(this.auth, new GithubAuthProvider());
          errorBox.textContent = "";
          let cRes: boolean = true;
          if (config && config.callbacks && config.callbacks.signInSuccessWithAuthResult) {
            let sUrl: string | null = null;
            if (config && config.signInSuccessUrl) {
              sUrl = config.signInSuccessUrl;
            }
            cRes = config.callbacks.signInSuccessWithAuthResult(res, sUrl);
          }
          if (cRes && config && config.signInSuccessUrl) {
            window.location.assign(config.signInSuccessUrl);
          }
        } catch (err) {
          errorBox.textContent = "Error! " + (err as Error).message;
        }
      };

      // Append provider buttons conditionally
      if (config.signInOptions?.includes(GoogleAuthProvider.PROVIDER_ID)) {
        box.appendChild(btnGoogle);
      }

      if (config.signInOptions?.includes(FacebookAuthProvider.PROVIDER_ID)) {
        box.appendChild(btnFacebook);
      }

      if (config.signInOptions?.includes(GithubAuthProvider.PROVIDER_ID)) {
        box.appendChild(btnGithub);
      }

      wrapper.appendChild(emailInput);
      wrapper.appendChild(passwordInput);

      if (config.signInOptions?.includes(EmailAuthProvider.PROVIDER_ID)) {
        wrapper.appendChild(loginBtn);
        wrapper.appendChild(registerBtn);
        wrapper.appendChild(toggleLink);
        wrapper.appendChild(orDivider);
      }

      wrapper.appendChild(box);

      wrapper.appendChild(logoutBtn);
      wrapper.appendChild(errorBox);

      const footer: HTMLDivElement = document.createElement("div");
      footer.className = "footer";
      wrapper.appendChild(footer);

      container.appendChild(wrapper);

      // Events
      loginBtn.onclick = async () => {
        try {
          const res: UserCredential = await signInWithEmailAndPassword(this.auth, emailInput.value, passwordInput.value);
          errorBox.textContent = "";
          let cRes: boolean = true;
          if (config && config.callbacks && config.callbacks.signInSuccessWithAuthResult) {
            let sUrl: string | null = null;
            if (config && config.signInSuccessUrl) {
              sUrl = config.signInSuccessUrl;
            }
            cRes = config.callbacks.signInSuccessWithAuthResult(res, sUrl);
          }
          if (cRes && config && config.signInSuccessUrl) {
            window.location.assign(config.signInSuccessUrl);
          }
        } catch (err) {
          errorBox.textContent = "Error! " + (err as Error).message;
        }
      };

      registerBtn.onclick = async () => {
        try {
          const res: UserCredential = await createUserWithEmailAndPassword(this.auth, emailInput.value, passwordInput.value);
          errorBox.textContent = "";
          let cRes: boolean = true;
          if (config && config.callbacks && config.callbacks.signInSuccessWithAuthResult) {
            let sUrl: string | null = null;
            if (config && config.signInSuccessUrl) {
              sUrl = config.signInSuccessUrl;
            }
            cRes = config.callbacks.signInSuccessWithAuthResult(res, sUrl);
          }
          if (cRes && config && config.signInSuccessUrl) {
            window.location.assign(config.signInSuccessUrl);
          }
        } catch (err) {
          errorBox.textContent = "Error! " + (err as Error).message;
        }
      };

      logoutBtn.onclick = async () => {
        await signOut(this.auth);
      };

      this.auth.onAuthStateChanged((user: User | null) => {
        logoutBtn.style.display = user ? "block" : "none";
        loginBtn.style.display = !user ? "block" : "none";
        registerBtn.style.display = !user ? "block" : "none";
        box.style.display = !user ? "flex" : "none";
        emailInput.style.display = !user ? "block" : "none";
        passwordInput.style.display = !user ? "block" : "none";
        toggleLink.style.display = !user ? "block" : "none";
        orDivider.style.display = !user ? "block" : "none";

        if (!user) {
          if (isSignup) {
            loginBtn.style.display = "none";
            registerBtn.style.display = "block";
          } else {
            loginBtn.style.display = "block";
            registerBtn.style.display = "none";
          }
        } else {
          loginBtn.style.display = "none";
          registerBtn.style.display = "none";
        }
      });
    }
  }
};
