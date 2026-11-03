/**
 * Daily calorie & macro targets using Mifflin-St Jeor BMR x activity factor,
 * adjusted for the user's goal.
 */
const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
const GOAL_ADJ = { lose: -500, maintain: 0, gain: 300 };

export function ageFromDob(dob, now = new Date()) {
  if (!dob) return 30;
  const d = new Date(dob);
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function computeTargets({ gender, dob, height_cm, weight_kg, activity_level, goal }) {
  if (!height_cm || !weight_kg) return null;
  const age = ageFromDob(dob);
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  const bmr = gender === 'female' ? base - 161 : gender === 'male' ? base + 5 : base - 78;
  const tdee = bmr * (ACTIVITY[activity_level] || ACTIVITY.light);
  const minimum = gender === 'female' ? 1200 : 1500;
  const calories = Math.max(minimum, Math.round((tdee + (GOAL_ADJ[goal] ?? 0)) / 10) * 10);
  const proteinPerKg = goal === 'gain' ? 1.8 : goal === 'lose' ? 1.6 : 1.2;
  const protein = Math.round(weight_kg * proteinPerKg);
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  const water = Math.round((weight_kg * 35) / 250) * 250;
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorie_target: calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    water_target_ml: Math.min(5000, Math.max(1500, water)),
  };
}

export function bmi(height_cm, weight_kg) {
  if (!height_cm || !weight_kg) return null;
  const v = weight_kg / (height_cm / 100) ** 2;
  const value = Math.round(v * 10) / 10;
  // Asian-Indian cut-offs
  const category = v < 18.5 ? 'Underweight' : v < 23 ? 'Normal' : v < 25 ? 'Overweight' : 'Obese';
  return { value, category };
}

/** Calories burned = MET x weight(kg) x hours */
export function caloriesBurned(met, weightKg, minutes) {
  return Math.round(met * (weightKg || 65) * (minutes / 60));
}
