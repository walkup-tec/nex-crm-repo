export type FacebookStatus = {
  status?: string;
};

export type FacebookSdk = {
  init: (options: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
  login: (callback: (response: FacebookStatus) => void, options?: { scope: string }) => void;
  getLoginStatus: (callback: (response: FacebookStatus) => void) => void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

let loading: Promise<FacebookSdk> | null = null;

export function loadFacebookSdk(appId: string, version: string) {
  if (!/^\d{5,32}$/.test(appId) || !/^v\d+\.\d+$/.test(version)) {
    return Promise.reject(new Error("config"));
  }
  if (typeof window === "undefined") return Promise.reject(new Error("browser"));
  const ready = window.FB;
  if (ready) {
    ready.init({ appId, cookie: true, xfbml: false, version });
    return Promise.resolve(ready);
  }
  if (loading) return loading;
  loading = new Promise<FacebookSdk>((resolve, reject) => {
    const finish = () => {
      const sdk = window.FB;
      if (!sdk) {
        loading = null;
        reject(new Error("sdk"));
        return;
      }
      sdk.init({ appId, cookie: true, xfbml: false, version });
      resolve(sdk);
    };
    const previous = window.fbAsyncInit;
    window.fbAsyncInit = () => {
      previous?.();
      finish();
    };
    if (document.getElementById("facebook-jssdk")) return;
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.onerror = () => {
      loading = null;
      reject(new Error("sdk"));
    };
    document.body.appendChild(script);
  });
  return loading;
}
