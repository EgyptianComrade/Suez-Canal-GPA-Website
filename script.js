// --- GPA Calculation and Curriculum Logic ---

function getGradeInfo(degree) {
  const score = parseFloat(degree);
  if (isNaN(score)) return { letter: 'N/A', points: 0.0 };
  if (score >= 96) return { letter: 'A+', points: 4.0 };
  if (score >= 92) return { letter: 'A', points: 3.7 };
  if (score >= 88) return { letter: 'A-', points: 3.4 };
  if (score >= 84) return { letter: 'B+', points: 3.2 };
  if (score >= 80) return { letter: 'B', points: 3.0 };
  if (score >= 76) return { letter: 'B-', points: 2.8 };
  if (score >= 72) return { letter: 'C+', points: 2.6 };
  if (score >= 68) return { letter: 'C', points: 2.4 };
  if (score >= 64) return { letter: 'C-', points: 2.2 };
  if (score >= 60) return { letter: 'D+', points: 2.0 };
  if (score >= 55) return { letter: 'D', points: 1.5 };
  if (score >= 50) return { letter: 'D-', points: 1.0 };
  return { letter: 'F', points: 0.0 };
}

const SOFTWARE_ENG_GPA_MAP = [
  [95, 100, 3.7, 4.0, 'A+'],
  [90, 95, 3.4, 3.7, 'A'],
  [85, 90, 3.1, 3.4, 'A-'],
  [80, 85, 2.8, 3.1, 'B+'],
  [75, 80, 2.5, 2.8, 'B'],
  [70, 75, 2.2, 2.5, 'C+'],
  [65, 70, 1.9, 2.2, 'C'],
  [60, 65, 1.6, 1.9, 'D+'],
  [50, 60, 1.0, 1.6, 'D'],
  [0, 50, 0.0, 0.0, 'F'],
];
function getGradeInfoSoftwareEng(degree) {
  const score = parseFloat(degree);
  if (isNaN(score)) return { letter: 'N/A', points: 0.0 };
  for (const [lower, upper, gpaMin, gpaMax, letter] of SOFTWARE_ENG_GPA_MAP) {
    if ((score >= lower && score < upper) || (upper === 100 && score === 100)) {
      let gpa = gpaMin === gpaMax ? gpaMin : gpaMin + (gpaMax - gpaMin) * (score - lower) / (upper - lower);
      return { letter, points: Math.round(gpa * 100) / 100 };
    }
  }
  return { letter: 'F', points: 0.0 };
}

function flattenSEcurriculum(jsonData) {
  const flat = {};
  for (const level in jsonData) {
    const semesters = jsonData[level];
    if (typeof semesters !== 'object') continue;
    for (const semester in semesters) {
      const courses = semesters[semester];
      if (!Array.isArray(courses)) continue;
      for (const course of courses) {
        const code = course.code;
        flat[code] = {
          name: course.name,
          credit_hours: course.credit_hours || 3,
          prerequisites: course.prerequisites || [],
          level: course.level,
          semester: course.semester,
          track: course.type || 'General',
          type: course.type || 'General',
        };
        // Add dashed/non-dashed versions
        if (!code.includes('-')) {
          const dashed = code.length > 3 ? code.slice(0,3)+'-'+code.slice(3) : code;
          flat[dashed] = flat[code];
        } else {
          flat[code.replace(/-/g, '')] = flat[code];
        }
      }
    }
  }
  return flat;
}

function processStudentData(studentResponse, curriculum, branch) {
  // Only a simple GPA calculation for now
  const allAttempts = {};
  let totalPoints = 0, totalHours = 0;
  let passedCourses = new Set();

  for (const course of (studentResponse.studentProgress || [])) {
    let code = (course.crscode || '|').split('|')[0];
    if (branch === 'Software Engineering') code = code.replace(/-/g, '');
    const courseInfo = curriculum[code];
    if (!courseInfo) continue;
    const degreeStr = course.Degree;
    let gradeInfo = branch === 'Software Engineering' ? getGradeInfoSoftwareEng(degreeStr) : getGradeInfo(degreeStr);
    if (gradeInfo.points > 0) passedCourses.add(code);
    if (typeof degreeStr === 'string' && degreeStr.trim() !== '' && gradeInfo.letter !== 'N/A') {
      totalPoints += gradeInfo.points * courseInfo.credit_hours;
      totalHours += courseInfo.credit_hours;
    }
  }
  return {
    gpa: totalHours > 0 ? (totalPoints / totalHours) : 0,
    completedHours: Array.from(passedCourses).reduce((sum, code) => sum + (curriculum[code]?.credit_hours || 0), 0),
    totalHours: Object.values(curriculum).reduce((sum, c) => sum + (c.credit_hours || 0), 0),
  };
}

// --- UI Integration ---
document.addEventListener('DOMContentLoaded', () => {
  let curriculums = null;

  fetch('Curriculums.json')
    .then(res => res.json())
    .then(data => { curriculums = data; })
    .catch(err => {
      document.getElementById('results').innerHTML = '<span style="color:red">Failed to load curriculums.json</span>';
    });

  document.getElementById('gpa-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const branch = document.getElementById('branch').value;
    const studentJson = document.getElementById('student-json').value;
    let studentData;
    try {
      studentData = JSON.parse(studentJson);
    } catch (err) {
      document.getElementById('results').innerHTML = '<span style="color:red">Invalid JSON data.</span>';
      return;
    }
    if (!curriculums) {
      document.getElementById('results').innerHTML = '<span style="color:red">Curriculums not loaded.</span>';
      return;
    }
    let curriculum, flatSE;
    if (branch === 'General') {
      curriculum = curriculums.General;
    } else if (branch === 'Software Engineering') {
      flatSE = flattenSEcurriculum(curriculums.SoftwareEngineering.curriculum);
      curriculum = flatSE;
    }
    const result = processStudentData(studentData, curriculum, branch);
    document.getElementById('results').innerHTML = `
      <h2>Results</h2>
      <p><strong>Cumulative GPA:</strong> ${result.gpa.toFixed(2)}</p>
      <p><strong>Completed Credit Hours:</strong> ${result.completedHours} / ${result.totalHours}</p>
    `;
  });
}); 