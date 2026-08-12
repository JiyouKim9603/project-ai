from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import openai
import json
import zipfile
import shutil
import os
import re
import tempfile
from datetime import date
from copy import deepcopy
from lxml import etree

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 설정 ────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TEMPLATE_PATH  = os.path.join(os.path.dirname(__file__), "template.pptx")

# ── 요청 모델 ────────────────────────────────────────
class PPTRequest(BaseModel):
    keyword: str

# ── GPT 호출 ─────────────────────────────────────────
def call_gpt(keyword: str) -> dict:
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": """당신은 프레젠테이션 전문가입니다. 키워드를 받으면 아래 JSON 형식으로만 응답하세요.

{
  "cover": {
    "subtitle": "한 줄 부제목 (20자 이내)",
    "description": "발표 개요 한 문장",
    "team": "팀명",
    "date": "날짜"
  },
  "overview": {
    "title": "개요 슬라이드 제목",
    "left_title": "왼쪽 섹션 제목",
    "left_body": "왼쪽 본문 내용 (3~4문장)",
    "right_body": "오른쪽 본문 내용 (3~4문장)"
  },
  "cards": {
    "title": "카드 슬라이드 제목",
    "card1_title": "카드1 제목",
    "card1_body": "카드1 내용 (2~3문장)",
    "card2_title": "카드2 제목",
    "card2_body": "카드2 내용 (2~3문장)",
    "card3_title": "카드3 제목",
    "card3_body": "카드3 내용 (2~3문장)"
  },
  "analysis": {
    "title": "분석 슬라이드 제목",
    "cause1_title": "원인1 제목",
    "cause1_body": "원인1 설명",
    "cause2_title": "원인2 제목",
    "cause2_body": "원인2 설명",
    "cause3_title": "원인3 제목",
    "cause3_body": "원인3 설명",
    "result": "결과 키워드 (10자 이내)",
    "result_body": "결과 상세 설명 (1~2문장, 50자 이내)"
  }
}

JSON만 반환하고 다른 텍스트는 절대 포함하지 마세요."""
            },
            {
                "role": "user",
                "content": f"키워드: {keyword}"
            }
        ]
    )
    text = response.choices[0].message.content
    clean = re.sub(r"```json|```", "", text).strip()
    return json.loads(clean)


# ── XML 텍스트 교체 헬퍼 ─────────────────────────────
NS = "http://schemas.openxmlformats.org/drawingml/2006/main"

def get_sp_text(sp) -> str:
    """shape의 모든 <a:t> 텍스트를 합쳐서 반환"""
    return "".join(t.text or "" for t in sp.iter(f"{{{NS}}}t"))

def set_sp_text(sp, new_text: str):
    """
    shape 안의 첫 번째 <a:r>의 <a:t>에 텍스트를 넣고
    나머지 <a:r>/<a:p>는 제거해 스타일을 보존합니다.
    """
    # 모든 <a:p> 찾기
    paras = sp.findall(f".//{{{NS}}}p")
    if not paras:
        return

    first_para = paras[0]

    # 첫 번째 <a:r> 찾기
    runs = first_para.findall(f"{{{NS}}}r")
    if runs:
        # 첫 번째 run에 텍스트 설정
        t_elem = runs[0].find(f"{{{NS}}}t")
        if t_elem is not None:
            t_elem.text = new_text
        # 나머지 run 제거
        for r in runs[1:]:
            first_para.remove(r)
    else:
        # run이 없으면 새로 생성
        r_elem = etree.SubElement(first_para, f"{{{NS}}}r")
        t_elem = etree.SubElement(r_elem, f"{{{NS}}}t")
        t_elem.text = new_text

    # 나머지 단락 제거 (첫 번째만 유지)
    for p in paras[1:]:
        p.getparent().remove(p)


def get_shapes(xml_bytes: bytes):
    """XML → root element, shape 목록 반환"""
    root = etree.fromstring(xml_bytes)
    PNS = "http://schemas.openxmlformats.org/presentationml/2006/main"
    sps = root.findall(f".//{{{PNS}}}sp")
    return root, sps


# ── 슬라이드별 교체 함수 ─────────────────────────────

def fill_slide1(xml_bytes: bytes, data: dict, keyword: str) -> bytes:
    """커버 슬라이드: sp[2]~sp[8]"""
    root, sps = get_shapes(xml_bytes)
    cover = data["cover"]
    today = date.today().strftime("%Y.%m.%d")

    # 키워드를 두 줄로 나눠서 겹침 방지
    words = keyword.split()
    half = len(words) // 2
    title_line1 = " ".join(words[:half]) if half > 0 else keyword
    title_line2 = " ".join(words[half:]) if half > 0 else ""

    mapping = {
        2: title_line1,                    # 첫 번째 줄 (검정)
        3: title_line2,                    # 두 번째 줄 (빨간색)
        4: cover.get("description", ""),
        5: cover.get("subtitle", ""),
        6: "팀  딸깍",
        7: today,
        8: "modui.ai"
    }
    for idx, text in mapping.items():
        if idx < len(sps):
            set_sp_text(sps[idx], text)

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def fill_slide2(xml_bytes: bytes, data: dict) -> bytes:
    """장문 텍스트 슬라이드: sp[14]~sp[19]"""
    root, sps = get_shapes(xml_bytes)
    ov = data["overview"]

    mapping = {
        14: ov.get("title", ""),
        15: ov.get("left_title", ""),
        17: ov.get("left_body", ""),
        18: ov.get("right_body", ""),
        19: ov.get("left_title", ""),
    }
    for idx, text in mapping.items():
        if idx < len(sps):
            set_sp_text(sps[idx], text)

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def fill_slide4(xml_bytes: bytes, data: dict) -> bytes:
    """3카드 슬라이드: sp[12]~sp[32]"""
    root, sps = get_shapes(xml_bytes)
    c = data["cards"]

    mapping = {
        12: c.get("title", ""),
        15: "",   # 섹션 번호 유지 (03)
        21: c.get("card1_body", ""),
        22: c.get("card2_body", ""),
        23: c.get("card3_body", ""),
        24: c.get("card1_title", ""),
        25: c.get("card2_title", ""),
        26: c.get("card3_title", ""),
        30: "01",
        31: "02",
        32: "03",
    }
    for idx, text in mapping.items():
        if idx < len(sps) and text:
            set_sp_text(sps[idx], text)

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def fill_slide8(xml_bytes: bytes, data: dict) -> bytes:
    """원인→결과 슬라이드: sp[12]~sp[39]"""
    root, sps = get_shapes(xml_bytes)
    a = data["analysis"]

    mapping = {
        12: a.get("title", ""),
        24: a.get("cause1_body", ""),
        25: a.get("cause2_body", ""),
        26: a.get("cause3_body", ""),
        35: a.get("cause1_title", ""),
        36: a.get("cause2_title", ""),
        37: a.get("cause3_title", ""),
        38: a.get("result_body", ""),
        39: a.get("result", "결과")[:10],   # 10자로 강제 자르기
    }
    for idx, text in mapping.items():
        if idx < len(sps):
            set_sp_text(sps[idx], text)

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def fill_slide15(xml_bytes: bytes, keyword: str) -> bytes:
    """마무리 슬라이드: 날짜/팀명 교체"""
    root, sps = get_shapes(xml_bytes)
    today = date.today().strftime("%Y.%m.%d")

    mapping = {
        4: f"{keyword} — 모듀이 AI 분석 결과",
        5: "딸깍팀 | CloudDX 7기 캡스톤 프로젝트",
        6: "팀  딸깍",
        7: today,
        8: "modui.ai"
    }
    for idx, text in mapping.items():
        if idx < len(sps):
            set_sp_text(sps[idx], text)

    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


# ── 메인 엔드포인트 ──────────────────────────────────
@app.post("/generate-ppt")
def generate_ppt(req: PPTRequest):
    keyword = req.keyword

    # 1) GPT 호출
    data = call_gpt(keyword)

    # 2) 템플릿 복사 → 임시 디렉토리에 압축 해제
    tmp_dir = tempfile.mkdtemp()
    tmp_pptx = os.path.join(tmp_dir, "output.pptx")
    unpacked = os.path.join(tmp_dir, "unpacked")

    shutil.copy(TEMPLATE_PATH, tmp_pptx)
    with zipfile.ZipFile(tmp_pptx, "r") as z:
        z.extractall(unpacked)

    # 3) 각 슬라이드 XML 교체
    slide_map = {
        "slide1.xml":  lambda x: fill_slide1(x, data, keyword),
        "slide2.xml":  lambda x: fill_slide2(x, data),
        "slide4.xml":  lambda x: fill_slide4(x, data),
        "slide8.xml":  lambda x: fill_slide8(x, data),
        "slide15.xml": lambda x: fill_slide15(x, keyword),
    }

    slides_dir = os.path.join(unpacked, "ppt", "slides")
    for filename, fill_fn in slide_map.items():
        path = os.path.join(slides_dir, filename)
        if os.path.exists(path):
            with open(path, "rb") as f:
                xml_bytes = f.read()
            new_xml = fill_fn(xml_bytes)
            with open(path, "wb") as f:
                f.write(new_xml)

    # 4) 사용할 슬라이드만 남기고 나머지 삭제 → presentation.xml 수정
    keep_slides = {"slide1.xml", "slide2.xml", "slide4.xml", "slide8.xml", "slide15.xml"}
    prs_path = os.path.join(unpacked, "ppt", "presentation.xml")

    with open(prs_path, "rb") as f:
        prs_root = etree.fromstring(f.read())

    PRS_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
    R_NS   = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

    # slide id 목록 파악
    sld_id_lst = prs_root.find(f"{{{PRS_NS}}}sldIdLst")

    # rels 파일에서 slide 파일명 ↔ rId 매핑
    rels_path = os.path.join(unpacked, "ppt", "_rels", "presentation.xml.rels")
    with open(rels_path, "rb") as f:
        rels_root = etree.fromstring(f.read())

    RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
    rid_to_file = {}
    for rel in rels_root.findall(f"{{{RELS_NS}}}Relationship"):
        target = rel.get("Target", "")
        if target.startswith("slides/slide") and target.endswith(".xml"):
            rid_to_file[rel.get("Id")] = os.path.basename(target)

    # sldIdLst에서 불필요한 슬라이드 제거
    if sld_id_lst is not None:
        to_remove = []
        for sld_id in sld_id_lst:
            rid = sld_id.get(f"{{{R_NS}}}id")
            fname = rid_to_file.get(rid, "")
            if fname not in keep_slides:
                to_remove.append(sld_id)
        for elem in to_remove:
            sld_id_lst.remove(elem)

    with open(prs_path, "wb") as f:
        f.write(etree.tostring(prs_root, xml_declaration=True, encoding="UTF-8", standalone=True))

    # 5) 다시 zip으로 압축
    out_path = os.path.join(tmp_dir, f"{keyword}_발표자료.pptx")
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zout:
        for root_dir, dirs, files in os.walk(unpacked):
            for file in files:
                file_path = os.path.join(root_dir, file)
                arcname = os.path.relpath(file_path, unpacked)
                zout.write(file_path, arcname)

    return FileResponse(
        out_path,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=f"{keyword}_발표자료.pptx"
    )


@app.get("/")
def root():
    return {"status": "ok", "service": "모듀이 PPT 생성 API"}