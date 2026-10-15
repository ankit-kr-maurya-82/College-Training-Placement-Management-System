import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import './GoogleSignInButton.css'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

export function GoogleSignInButton({ disabled = false, onCredential, onError }) {
  if (!clientId) {
    return <p className="google-sign-in-setup" role="status">
      Google sign-in setup required: add your Web OAuth client ID to
      {' '}<code>fronted/.env.local</code> as <code>VITE_GOOGLE_CLIENT_ID</code>,
      then restart the frontend.
    </p>
  }

  return <div className={`google-sign-in${disabled ? ' is-disabled' : ''}`} aria-busy={disabled}>
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleLogin
        text="continue_with"
        theme="outline"
        shape="rectangular"
        size="large"
        useOneTap={false}
        auto_select={false}
        cancel_on_tap_outside
        onSuccess={(response) => {
          if (response.credential) onCredential(response.credential)
          else onError()
        }}
        onError={onError}
      />
    </GoogleOAuthProvider>
  </div>
}
