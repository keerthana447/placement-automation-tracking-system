from flask import Flask, request, jsonify
from flask_cors import CORS
import pymysql
import pymysql.cursors
import time
import json
import os

app = Flask(__name__)
CORS(app)  # Allow frontend to communicate

# ---------------------------------------------------------
# DATABASE CONFIG
# Password comes from an environment variable (DB_PASSWORD) so it's
# never written in plain text in code that goes on GitHub.
# For local testing, it falls back to the placeholder below - replace
# that only on your own machine, never commit a real password.
# ---------------------------------------------------------
DB_CONFIG = {
    "host": "placement-db-placement-automation.j.aivencloud.com",
    "port": 14463,
    "user": "avnadmin",
    "password": os.environ.get("DB_PASSWORD", "YOUR_AIVEN_MYSQL_PASSWORD_HERE"),
    "database": "defaultdb",
    "ssl": {"ca": "ca.pem"},
    "cursorclass": pymysql.cursors.DictCursor
}

def get_conn():
    return pymysql.connect(**DB_CONFIG)

def parse_json_fields(row, fields):
    """MySQL JSON columns come back as strings/None - convert to Python objects"""
    for f in fields:
        if row.get(f) is not None and isinstance(row[f], str):
            try:
                row[f] = json.loads(row[f])
            except (json.JSONDecodeError, TypeError):
                pass
    return row

# ---------------------------------------------------------
# STUDENTS
# ---------------------------------------------------------
@app.route('/api/students', methods=['GET'])
def get_students():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM students")
            rows = cur.fetchall()
            rows = [parse_json_fields(r, ['marks', 'skills', 'resumes']) for r in rows]
        return jsonify(rows)
    finally:
        conn.close()

@app.route('/api/students', methods=['POST'])
def create_student():
    data = request.json
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO students (name, email, usn, branch, currentSem, marks, classRank, achievements, skills, resumes, status)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                data.get('name'), data.get('email'), data.get('usn'), data.get('branch'),
                data.get('currentSem'), json.dumps(data.get('marks', [])), data.get('classRank'),
                data.get('achievements'), json.dumps(data.get('skills', [])),
                json.dumps(data.get('resumes', [])), data.get('status', 'Incomplete')
            ))
        conn.commit()
        new_id = cur.lastrowid
        return jsonify({"success": True, "id": new_id})
    finally:
        conn.close()

@app.route('/api/students/<int:student_id>', methods=['PUT'])
def update_student(student_id):
    data = request.json
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE students SET name=%s, email=%s, usn=%s, branch=%s, currentSem=%s,
                marks=%s, classRank=%s, achievements=%s, skills=%s, resumes=%s, status=%s, rejectReason=%s
                WHERE id=%s
            """, (
                data.get('name'), data.get('email'), data.get('usn'), data.get('branch'),
                data.get('currentSem'), json.dumps(data.get('marks', [])), data.get('classRank'),
                data.get('achievements'), json.dumps(data.get('skills', [])),
                json.dumps(data.get('resumes', [])), data.get('status'), data.get('rejectReason'),
                student_id
            ))
        conn.commit()
        return jsonify({"success": True})
    finally:
        conn.close()

@app.route('/api/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM students WHERE id=%s", (student_id,))
        conn.commit()
        return jsonify({"success": True})
    finally:
        conn.close()

# ---------------------------------------------------------
# JOBS
# ---------------------------------------------------------
@app.route('/api/jobs', methods=['GET'])
def get_jobs():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM jobs ORDER BY createdAt DESC")
            rows = cur.fetchall()
            rows = [parse_json_fields(r, ['skills']) for r in rows]
        return jsonify(rows)
    finally:
        conn.close()

@app.route('/api/jobs', methods=['POST'])
def create_job():
    data = request.json
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO jobs (title, company, location, salary, duration, eligibility, contact, deadline, skills, description, applyLink)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                data.get('title'), data.get('company'), data.get('location'), data.get('salary'),
                data.get('duration'), data.get('eligibility'), data.get('contact'), data.get('deadline'),
                json.dumps(data.get('skills', [])), data.get('description'), data.get('applyLink')
            ))
        conn.commit()
        new_id = cur.lastrowid
        return jsonify({"success": True, "id": new_id})
    finally:
        conn.close()

@app.route('/api/jobs/<int:job_id>', methods=['PUT'])
def update_job(job_id):
    data = request.json
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE jobs SET title=%s, company=%s, location=%s, salary=%s, duration=%s,
                eligibility=%s, contact=%s, deadline=%s, skills=%s, description=%s, applyLink=%s
                WHERE id=%s
            """, (
                data.get('title'), data.get('company'), data.get('location'), data.get('salary'),
                data.get('duration'), data.get('eligibility'), data.get('contact'), data.get('deadline'),
                json.dumps(data.get('skills', [])), data.get('description'), data.get('applyLink'),
                job_id
            ))
        conn.commit()
        return jsonify({"success": True})
    finally:
        conn.close()

@app.route('/api/jobs/<int:job_id>', methods=['DELETE'])
def delete_job(job_id):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM jobs WHERE id=%s", (job_id,))
        conn.commit()
        return jsonify({"success": True})
    finally:
        conn.close()

# ---------------------------------------------------------
# APPLICATIONS
# ---------------------------------------------------------
@app.route('/api/applications', methods=['GET'])
def get_applications():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM applications")
            rows = cur.fetchall()
        return jsonify(rows)
    finally:
        conn.close()

@app.route('/api/applications', methods=['POST'])
def create_application():
    data = request.json
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO applications (jobId, studentId, status, date, matchScore)
                VALUES (%s,%s,%s,%s,%s)
            """, (
                data.get('jobId'), data.get('studentId'), data.get('status', 'Applied'),
                data.get('date'), data.get('matchScore', 0)
            ))
        conn.commit()
        new_id = cur.lastrowid
        return jsonify({"success": True, "id": new_id})
    finally:
        conn.close()

@app.route('/api/applications/<int:app_id>', methods=['PUT'])
def update_application(app_id):
    data = request.json
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE applications SET status=%s WHERE id=%s", (data.get('status'), app_id))
        conn.commit()
        return jsonify({"success": True})
    finally:
        conn.close()

# ---------------------------------------------------------
# RESOURCES
# ---------------------------------------------------------
@app.route('/api/resources', methods=['GET'])
def get_resources():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM resources")
            rows = cur.fetchall()
        return jsonify(rows)
    finally:
        conn.close()

@app.route('/api/resources', methods=['POST'])
def create_resource():
    data = request.json
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO resources (title, url, type) VALUES (%s,%s,%s)",
                        (data.get('title'), data.get('url'), data.get('type')))
        conn.commit()
        new_id = cur.lastrowid
        return jsonify({"success": True, "id": new_id})
    finally:
        conn.close()

# ---------------------------------------------------------
# NOTIFICATIONS
# ---------------------------------------------------------
@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    audience = request.args.get('audience', 'hrd')
    student_id = request.args.get('studentId')
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if audience == 'student' and student_id:
                cur.execute(
                    "SELECT id, message, date, isRead AS `read`, studentId FROM notifications "
                    "WHERE audience='student' AND (studentId IS NULL OR studentId=%s) ORDER BY id DESC",
                    (student_id,)
                )
            else:
                cur.execute(
                    "SELECT id, message, date, isRead AS `read`, studentId FROM notifications "
                    "WHERE audience=%s ORDER BY id DESC",
                    (audience,)
                )
            rows = cur.fetchall()
            for r in rows:
                r['read'] = bool(r['read'])
        return jsonify(rows)
    finally:
        conn.close()

@app.route('/api/notifications', methods=['POST'])
def create_notification():
    data = request.json
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO notifications (message, date, audience, studentId) VALUES (%s,%s,%s,%s)",
                (data.get('message'), data.get('date'), data.get('audience', 'hrd'), data.get('studentId'))
            )
        conn.commit()
        new_id = cur.lastrowid
        return jsonify({"success": True, "id": new_id})
    finally:
        conn.close()

@app.route('/api/notifications/<int:notif_id>', methods=['PUT'])
def update_notification(notif_id):
    data = request.json
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE notifications SET isRead=%s WHERE id=%s", (data.get('read', True), notif_id))
        conn.commit()
        return jsonify({"success": True})
    finally:
        conn.close()

# ---------------------------------------------------------
# EXISTING MOCK NLP ENDPOINTS (kept as-is for now)
# ---------------------------------------------------------
@app.route('/api/parse-email', methods=['POST'])
def parse_email():
    data = request.json
    email_text = data.get('email_text', '')
    if not email_text:
        return jsonify({"error": "No email text provided"}), 400
    time.sleep(1.5)
    extracted_data = {
        "title": "Software Engineer Intern",
        "company": "Tech Innovations Inc.",
        "salary": "$4000/month",
        "skills": ["React", "Python", "SQL", "Git"],
        "eligibility": "B.Tech CS 2026 Batch, 8.0+ CGPA",
        "deadline": "2026-06-15"
    }
    return jsonify({"success": True, "extracted_data": extracted_data, "message": "NLP extraction successful"})

@app.route('/api/analyze-resume', methods=['POST'])
def analyze_resume():
    if 'resume' not in request.files:
        return jsonify({"error": "No resume file uploaded"}), 400
    time.sleep(2)
    analysis_result = {
        "score": 78,
        "skillsExtracted": ["JavaScript", "HTML/CSS", "Python Basics", "Teamwork"],
        "missingSkills": ["React", "Node.js", "System Design"],
        "feedback": "Your resume shows good foundational programming knowledge."
    }
    return jsonify({"success": True, "analysis": analysis_result})

@app.route('/api/chatbot', methods=['POST'])
def chatbot():
    data = request.json
    message = data.get('message', '').lower()
    time.sleep(1)
    reply = "I'm your AI career assistant. How can I help?"
    if "interview" in message:
        reply = "For interviews, remember to use the STAR method (Situation, Task, Action, Result). Need practice?"
    elif "resume" in message:
        reply = "Make sure your resume highlights quantifiable achievements! You can use our Analyzer to score it."
    return jsonify({"reply": reply})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    is_local = os.environ.get('PORT') is None  # Render always sets PORT; local runs don't
    print(f"Starting AI Placement Management Backend on port {port}...")
    app.run(debug=is_local, port=port, host='0.0.0.0')
