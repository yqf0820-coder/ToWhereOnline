const TOKEN_KEY = 'towhere_auth_token';

export function isLoggedIn() {
  return !!localStorage.getItem(TOKEN_KEY);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(username, password) {
  if (!username || !password) throw new Error('请输入用户名和密码');
  localStorage.setItem(TOKEN_KEY, username);
}

export async function signup(username, password) {
  if (!username || !password) throw new Error('请输入用户名和密码');
  localStorage.setItem(TOKEN_KEY, username);
}
