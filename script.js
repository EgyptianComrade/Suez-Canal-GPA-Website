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

// Enhanced: Process student data and organize by semester
function processStudentDataDetailed(studentResponse, curriculum, branch) {
  const semesters = {};
  const allAttempts = {};
  let totalPoints = 0, totalHours = 0;
  let passedCourses = new Set();

  for (const course of (studentResponse.studentProgress || [])) {
    let code = (course.crscode || '|').split('|')[0];
    if (branch === 'Software Engineering') code = code.replace(/-/g, '');
    const courseInfo = curriculum[code];
    if (!courseInfo) continue;
    const degreeStr = course.Degree;
    let isUni = code.startsWith('UNI-');
    let letter = '';
    let points = 0;
    if (isUni) {
      // UNI- courses: Pass/Fail only, not included in GPA
      if (typeof course.gradeN === 'string' && course.gradeN.trim().toUpperCase() === 'P') {
        letter = 'P';
      } else {
        letter = 'F';
      }
      points = 0;
    } else {
      let gradeInfo = branch === 'Software Engineering' ? getGradeInfoSoftwareEng(degreeStr) : getGradeInfo(degreeStr);
      letter = gradeInfo.letter;
      points = gradeInfo.points;
    }
    let semesterId = course.yearsem || 'Unknown';
    let semesterName = course.semesterCourse ? course.semesterCourse.split('|')[1] : 'Unknown';
    if (!semesters[semesterId]) {
      semesters[semesterId] = {
        name: semesterName,
        courses: [],
        totalPoints: 0,
        totalHours: 0
      };
    }
    const courseObj = {
      name: courseInfo.name,
      code: code,
      hours: courseInfo.credit_hours,
      degree: degreeStr,
      letter: letter,
      points: points
    };
    semesters[semesterId].courses.push(courseObj);
    // Only include non-UNI courses in GPA calculation
    if (!isUni && typeof degreeStr === 'string' && degreeStr.trim() !== '' && letter !== 'N/A') {
      semesters[semesterId].totalPoints += points * courseInfo.credit_hours;
      semesters[semesterId].totalHours += courseInfo.credit_hours;
      totalPoints += points * courseInfo.credit_hours;
      totalHours += courseInfo.credit_hours;
    }
    if (!isUni && points > 0) passedCourses.add(code);
  }
  // Sort semesters by key
  const sortedSemesters = Object.entries(semesters).sort((a, b) => a[0].localeCompare(b[0]));
  return {
    semesters: sortedSemesters,
    gpa: totalHours > 0 ? (totalPoints / totalHours) : 0,
    completedHours: Array.from(passedCourses).reduce((sum, code) => sum + (curriculum[code]?.credit_hours || 0), 0),
    totalHours: Object.values(curriculum).reduce((sum, c) => sum + (c.credit_hours || 0), 0),
  };
}

function renderSemesterTable(semester) {
  let html = `<h3>${semester.name}</h3>`;
  html += `<table class="gpa-table"><thead><tr><th>Course Name</th><th>Code</th><th>Credit Hours</th><th>Degree</th><th>Letter Grade</th></tr></thead><tbody>`;
  for (const c of semester.courses) {
    html += `<tr><td>${c.name}</td><td>${c.code}</td><td>${c.hours}</td><td>${c.degree}</td><td>${c.letter}</td></tr>`;
  }
  html += `</tbody></table>`;
  if (semester.totalHours > 0) {
    html += `<p><strong>Semester GPA:</strong> ${(semester.totalPoints/semester.totalHours).toFixed(2)}</p>`;
  }
  return html;
}

// --- UI Integration ---
document.addEventListener('DOMContentLoaded', () => {
  let curriculums = null;
  let lastResult = null;

  fetch('Curriculums.json')
    .then(res => res.json())
    .then(data => { curriculums = data; })
    .catch(err => {
      document.getElementById('results').innerHTML = '<span style="color:red">Failed to load curriculums.json</span>';
    });

  // Add semester selector
  const semesterSelector = document.createElement('select');
  semesterSelector.id = 'semester-select';
  semesterSelector.style.display = 'none';
  semesterSelector.innerHTML = '<option value="all">All Semesters</option>';
  document.getElementById('gpa-form').appendChild(document.createElement('br'));
  document.getElementById('gpa-form').appendChild(semesterSelector);

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
    lastResult = processStudentDataDetailed(studentData, curriculum, branch);
    // Populate semester selector
    semesterSelector.innerHTML = '<option value="all">All Semesters</option>';
    for (const [semId, sem] of lastResult.semesters) {
      semesterSelector.innerHTML += `<option value="${semId}">${sem.name}</option>`;
    }
    semesterSelector.style.display = '';
    renderResults('all');
  });

  semesterSelector.addEventListener('change', function() {
    renderResults(this.value);
  });

  function renderResults(selectedSemester) {
    if (!lastResult) return;
    let html = `<h2>Results</h2>`;
    html += `<p><strong>Cumulative GPA:</strong> ${lastResult.gpa.toFixed(2)}</p>`;
    html += `<p><strong>Completed Credit Hours:</strong> ${lastResult.completedHours} / ${lastResult.totalHours}</p>`;
    if (selectedSemester === 'all') {
      for (const [semId, sem] of lastResult.semesters) {
        html += renderSemesterTable(sem);
      }
    } else {
      const sem = lastResult.semesters.find(([id, _]) => id === selectedSemester);
      if (sem) html += renderSemesterTable(sem[1]);
    }
    document.getElementById('results').innerHTML = html;
  }
}); 