import { login } from "@/lib/actions"

export default async function LoginPage(props: PageProps<"/login">) {
  const { error } = await props.searchParams
  return (
    <form action={login} className="card login">
      <h1>Acceso</h1>
      <p className="muted">Este despliegue está protegido. Ingresa la clave de acceso que viene en el README.</p>
      <input name="key" type="password" placeholder="Clave de acceso" autoFocus required />
      {error && <span className="danger-text">Clave incorrecta.</span>}
      <button className="primary">Entrar</button>
    </form>
  )
}
