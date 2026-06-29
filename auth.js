// Script to handle authentication and RBAC con Supabase real
const supabaseUrl = 'https://odwwygzhwwdnjlacubnp.supabase.co';
const supabaseKey = 'sb_publishable_OCnI22yFQE2HmFqoyLWNvA_9wVjJ2kw';
window.supabaseClient = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

async function login(email, password) {
    if (!window.supabaseClient) {
        alert("Error: Supabase client not loaded");
        return false;
    }
    
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });
    
    if (error) {
        console.error("Login error:", error.message);
        return false;
    }
    
    // Fetch profile to get the role
    const { data: profileData, error: profileError } = await window.supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
        
    if (profileError) {
        console.error("Error fetching profile:", profileError);
        // Fallback role
        localStorage.setItem('user', JSON.stringify({ 
            id: data.user.id,
            email: email, 
            role: 'mesa de entrada', 
            name: email.split('@')[0] 
        }));
    } else {
        localStorage.setItem('user', JSON.stringify({ 
            id: data.user.id,
            email: email, 
            role: profileData.rol?.toLowerCase() || 'mesa de entrada', 
            name: profileData.nombre_completo || email.split('@')[0] 
        }));
    }
    return true;
}

async function logout() {
    if (window.supabaseClient) {
        await window.supabaseClient.auth.signOut();
    }
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

function checkAuthAndRole() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    const currentPath = window.location.pathname;
    
    // Role based access control
    if (user.role === 'coordinador') {
        const allowedPaths = ['/consulta.html', '/calendario.html'];
        const isAllowed = allowedPaths.some(p => currentPath.includes(p));
        if (!isAllowed && currentPath !== '/' && currentPath !== '/index.html') {
            window.location.href = 'consulta.html';
        }
    }
    
    // Update UI
    document.addEventListener('DOMContentLoaded', () => {
        const userNameEl = document.querySelector('.usuario-nombre');
        const userRoleEl = document.querySelector('.usuario-rol');
        if (userNameEl) userNameEl.textContent = user.name;
        if (userRoleEl) userRoleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
        
        const btnLogout = document.querySelector('.btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', logout);
        }
        
        // Hide sidebar items based on role
        if (user.role === 'coordinador') {
            // Hide elements marked for 'mesa de entrada' only (via data-rol attribute)
            const restrictedItems = document.querySelectorAll('[data-rol="mesa de entrada"]');
            restrictedItems.forEach(item => {
                item.style.display = 'none';
            });
            // Also hide via text content for recepcion/asignacion pages using li > a structure
            const menuItems = document.querySelectorAll('.sidebar-menu li');
            menuItems.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (!text.includes('consulta') && !text.includes('calendario')) {
                    item.style.display = 'none';
                }
            });
        }
    });
}
