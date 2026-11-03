/** Initial Nalam schema. */
export async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 120);
    t.string('email', 255).unique();
    t.boolean('email_verified').notNullable().defaultTo(false);
    t.string('phone', 20).unique();
    t.boolean('phone_verified').notNullable().defaultTo(false);
    t.string('password_hash');
    t.string('google_id').unique();
    t.string('avatar_url');
    t.string('role', 20).notNullable().defaultTo('user'); // user | admin
    t.string('status', 20).notNullable().defaultTo('active'); // active | blocked
    t.integer('token_version').notNullable().defaultTo(0);
    t.timestamp('trial_ends_at', { useTz: true });
    t.timestamp('premium_until', { useTz: true });
    // profile
    t.string('gender', 10);
    t.date('dob');
    t.decimal('height_cm', 5, 1);
    t.decimal('weight_kg', 5, 1);
    t.decimal('target_weight_kg', 5, 1);
    t.string('activity_level', 20);
    t.string('goal', 20);
    t.string('diet_pref', 20);
    t.integer('calorie_target');
    t.integer('protein_g');
    t.integer('carbs_g');
    t.integer('fat_g');
    t.integer('water_target_ml').defaultTo(2500);
    t.integer('step_target').defaultTo(8000);
    t.boolean('onboarded').notNullable().defaultTo(false);
    t.timestamp('last_login_at', { useTz: true });
    t.timestamps(true, true);
  });

  await knex.schema.createTable('otps', (t) => {
    t.bigIncrements('id');
    t.string('channel', 10).notNullable();
    t.string('target', 255).notNullable();
    t.string('purpose', 20).notNullable();
    t.string('code_hash').notNullable();
    t.integer('attempts').notNullable().defaultTo(0);
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('consumed_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['channel', 'target', 'purpose']);
  });

  await knex.schema.createTable('settings', (t) => {
    t.string('key', 64).primary();
    t.jsonb('value').notNullable();
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('plans', (t) => {
    t.increments('id');
    t.string('code', 40).notNullable().unique();
    t.string('name', 80).notNullable();
    t.string('interval', 10).notNullable(); // month | year | custom
    t.integer('duration_days').notNullable();
    t.integer('price_paise').notNullable();
    t.integer('mrp_paise');
    t.string('currency', 3).notNullable().defaultTo('INR');
    t.text('description');
    t.jsonb('highlights').notNullable().defaultTo('[]');
    t.boolean('active').notNullable().defaultTo(true);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('coupons', (t) => {
    t.string('code', 40).primary();
    t.integer('percent_off');
    t.integer('amount_off_paise');
    t.integer('max_redemptions');
    t.integer('redeemed_count').notNullable().defaultTo(0);
    t.timestamp('expires_at', { useTz: true });
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('payments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.integer('plan_id').references('plans.id').onDelete('SET NULL');
    t.string('provider', 20).notNullable(); // razorpay | mock | manual
    t.string('provider_order_id').unique();
    t.string('provider_payment_id');
    t.integer('amount_paise').notNullable();
    t.string('currency', 3).notNullable().defaultTo('INR');
    t.string('status', 20).notNullable().defaultTo('created'); // created | paid | failed | refunded
    t.string('coupon_code', 40);
    t.integer('duration_days').notNullable();
    t.timestamp('period_start', { useTz: true });
    t.timestamp('period_end', { useTz: true });
    t.text('note');
    t.jsonb('raw');
    t.timestamps(true, true);
    t.index(['user_id']);
  });

  await knex.schema.createTable('foods', (t) => {
    t.increments('id');
    t.string('name', 160).notNullable();
    t.string('local_name', 160);
    t.string('category', 60);
    t.string('serving_desc', 80).notNullable().defaultTo('1 serving');
    t.decimal('serving_g', 7, 1);
    t.decimal('calories', 7, 1).notNullable();
    t.decimal('protein_g', 6, 1).notNullable().defaultTo(0);
    t.decimal('carbs_g', 6, 1).notNullable().defaultTo(0);
    t.decimal('fat_g', 6, 1).notNullable().defaultTo(0);
    t.decimal('fiber_g', 6, 1).notNullable().defaultTo(0);
    t.boolean('is_veg').notNullable().defaultTo(true);
    t.string('image_url');
    t.uuid('created_by').references('users.id').onDelete('CASCADE'); // null = global (admin)
    t.boolean('verified').notNullable().defaultTo(false);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('food_logs', (t) => {
    t.bigIncrements('id');
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.integer('food_id').references('foods.id').onDelete('SET NULL');
    t.string('food_name', 160).notNullable();
    t.date('date').notNullable();
    t.string('meal', 20).notNullable(); // breakfast | lunch | snacks | dinner
    t.decimal('servings', 6, 2).notNullable().defaultTo(1);
    t.decimal('calories', 7, 1).notNullable();
    t.decimal('protein_g', 6, 1).notNullable().defaultTo(0);
    t.decimal('carbs_g', 6, 1).notNullable().defaultTo(0);
    t.decimal('fat_g', 6, 1).notNullable().defaultTo(0);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'date']);
  });

  await knex.schema.createTable('water_logs', (t) => {
    t.bigIncrements('id');
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.date('date').notNullable();
    t.integer('amount_ml').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'date']);
  });

  for (const [name, col] of [
    ['weight_logs', (t) => t.decimal('weight_kg', 5, 1).notNullable()],
    ['step_logs', (t) => t.integer('steps').notNullable()],
    ['sleep_logs', (t) => { t.decimal('hours', 4, 1).notNullable(); t.integer('quality'); }],
    ['mood_logs', (t) => { t.integer('mood').notNullable(); t.string('note', 280); }],
  ]) {
    await knex.schema.createTable(name, (t) => {
      t.bigIncrements('id');
      t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
      t.date('date').notNullable();
      col(t);
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.unique(['user_id', 'date']);
    });
  }

  await knex.schema.createTable('exercises', (t) => {
    t.increments('id');
    t.string('name', 120).notNullable();
    t.string('slug', 140).notNullable().unique();
    t.string('category', 30).notNullable(); // strength | cardio | yoga | stretching | hiit
    t.string('muscle_group', 60);
    t.string('equipment', 60).defaultTo('none');
    t.string('difficulty', 20).defaultTo('beginner');
    t.string('image_url');
    t.text('instructions');
    t.decimal('met', 4, 1).notNullable().defaultTo(4);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('workouts', (t) => {
    t.increments('id');
    t.string('title', 140).notNullable();
    t.string('slug', 160).notNullable().unique();
    t.text('description');
    t.string('image_url');
    t.string('category', 30).notNullable();
    t.string('difficulty', 20).notNullable().defaultTo('beginner');
    t.integer('duration_min').notNullable().defaultTo(15);
    t.integer('calories_est').notNullable().defaultTo(100);
    t.boolean('is_premium').notNullable().defaultTo(true);
    t.boolean('published').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('workout_exercises', (t) => {
    t.increments('id');
    t.integer('workout_id').notNullable().references('workouts.id').onDelete('CASCADE');
    t.integer('exercise_id').notNullable().references('exercises.id').onDelete('CASCADE');
    t.integer('position').notNullable().defaultTo(0);
    t.integer('sets').notNullable().defaultTo(1);
    t.integer('reps');
    t.integer('duration_sec');
    t.integer('rest_sec').notNullable().defaultTo(20);
  });

  await knex.schema.createTable('workout_logs', (t) => {
    t.bigIncrements('id');
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.integer('workout_id').references('workouts.id').onDelete('SET NULL');
    t.string('title', 140).notNullable();
    t.date('date').notNullable();
    t.integer('duration_min').notNullable();
    t.integer('calories_burned').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'date']);
  });

  await knex.schema.createTable('recipes', (t) => {
    t.increments('id');
    t.string('title', 160).notNullable();
    t.string('image_url');
    t.text('description');
    t.jsonb('ingredients').notNullable().defaultTo('[]');
    t.jsonb('steps').notNullable().defaultTo('[]');
    t.integer('calories').notNullable().defaultTo(0);
    t.decimal('protein_g', 6, 1).defaultTo(0);
    t.decimal('carbs_g', 6, 1).defaultTo(0);
    t.decimal('fat_g', 6, 1).defaultTo(0);
    t.integer('prep_min').defaultTo(15);
    t.string('diet_type', 20).defaultTo('veg');
    t.string('meal_type', 20).defaultTo('lunch');
    t.boolean('published').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('articles', (t) => {
    t.increments('id');
    t.string('title', 200).notNullable();
    t.string('image_url');
    t.string('category', 40).defaultTo('wellness');
    t.text('summary');
    t.text('body').notNullable();
    t.boolean('published').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('coach_messages', (t) => {
    t.bigIncrements('id');
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.string('sender', 10).notNullable(); // user | coach
    t.uuid('coach_id').references('users.id').onDelete('SET NULL');
    t.text('body').notNullable();
    t.timestamp('read_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'created_at']);
  });

  await knex.schema.createTable('notifications', (t) => {
    t.bigIncrements('id');
    t.uuid('user_id').references('users.id').onDelete('CASCADE'); // null = broadcast
    t.string('title', 140).notNullable();
    t.text('body').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  for (const t of [
    'notifications', 'coach_messages', 'articles', 'recipes', 'workout_logs', 'workout_exercises',
    'workouts', 'exercises', 'mood_logs', 'sleep_logs', 'step_logs', 'weight_logs', 'water_logs',
    'food_logs', 'foods', 'payments', 'coupons', 'plans', 'settings', 'otps', 'users',
  ]) {
    await knex.schema.dropTableIfExists(t);
  }
}
