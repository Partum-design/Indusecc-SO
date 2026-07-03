require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabaseClient');

const TABLES = [
  'profiles', 'registration_requests', 'custom_roles', 'configurations',
  'audits', 'findings', 'risks', 'actions', 'documents', 'trainings',
  'certificates', 'calendar_events', 'audit_logs'
];

const run = async () => {
  console.log(`Conectando a Supabase: ${process.env.SUPABASE_URL}`);

  for (const table of TABLES) {
    const { count, error } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true });
    if (error) {
      console.error(`- ${table}: ERROR (${error.message})`);
    } else {
      console.log(`- ${table}: ${count} filas`);
    }
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('email, role, active')
    .order('created_at', { ascending: true });

  if (!profilesError) {
    console.log('\nUsuarios registrados:');
    profiles.forEach(p => console.log(`- ${p.email} (${p.role}, ${p.active ? 'activo' : 'inactivo'})`));
  }
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error al verificar la base de datos:', error.message);
    process.exit(1);
  });
