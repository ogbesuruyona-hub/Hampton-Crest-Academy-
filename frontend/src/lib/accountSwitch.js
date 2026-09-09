export async function switchAccount(logout, navigate) {
  await logout();
  navigate("/login", { replace: true });
}
