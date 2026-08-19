from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import openai, json, zipfile, shutil, os, re, tempfile
from datetime import date
from lxml import etree
from typing import Optional

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TEMPLATE_PATH  = os.path.join(os.path.dirname(__file__), "template.pptx")

NS  = "http://schemas.openxmlformats.org/drawingml/2006/main"          # drawingml
PNS = "http://schemas.openxmlformats.org/presentationml/2006/main"     # presentationml
RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

class PPTRequest(BaseModel):
    keyword: str
    team: Optional[str] = "딸깍"
    slide_count: Optional[int] = 5

COMBO_3  = [("slide1.xml","cover"),("slide4.xml","cards"),("slide15.xml","outro")]
COMBO_5  = [("slide1.xml","cover"),("slide2.xml","overview"),("slide4.xml","cards"),("slide8.xml","analysis"),("slide15.xml","outro")]
COMBO_7  = [("slide1.xml","cover"),("slide2.xml","overview"),("slide4.xml","cards"),("slide7.xml","list"),("slide8.xml","analysis"),("slide10.xml","cards4"),("slide15.xml","outro")]
COMBO_10 = [("slide1.xml","cover"),("slide2.xml","overview"),("slide4.xml","cards"),("slide6.xml","keywords"),("slide7.xml","list"),("slide8.xml","analysis"),("slide10.xml","cards4"),("slide11.xml","timeline"),("slide2.xml","overview2"),("slide15.xml","outro")]
COMBOS   = {3:COMBO_3, 5:COMBO_5, 7:COMBO_7, 10:COMBO_10}


# ──────────────────────────────────────────────
# 한자 후처리
# ──────────────────────────────────────────────
def filter_hanja(text: str) -> str:
    """CJK 통합 한자 범위 제거 (한글·영문·숫자·특수문자 유지)"""
    return re.sub(r'[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]', '', text)

def sanitize_data(data):
    """재귀적으로 모든 문자열 값에서 한자 제거"""
    if isinstance(data, dict):
        return {k: sanitize_data(v) for k, v in data.items()}
    if isinstance(data, str):
        return filter_hanja(data)
    return data


# ──────────────────────────────────────────────
# GPT 호출
# ──────────────────────────────────────────────
def call_gpt(keyword):
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": """당신은 프레젠테이션 콘텐츠 작성 전문가입니다. 키워드를 받아 JSON을 생성하세요.
반드시 아래 규칙을 따르세요:
1. JSON만 반환, 다른 텍스트 절대 금지
2. 글자수 제한은 반드시 지켜야 하는 최대값입니다. 초과하면 절대 안됩니다
3. 본문 필드는 지정된 글자수를 최대한 채워서 작성
4. 제목은 간결하고 핵심만 담아야 합니다
5. 한자 사용 절대 금지. 强, 化, 性 등 한자 포함하면 안됨. 순한글 또는 영문만 사용
6. 카드 제목은 핵심 키워드로 작성, 숫자 나열(이점1, 항목2 등) 절대 금지

{
  "cover": {
    "title_line1": "제목 앞부분 (6자이내)",
    "title_line2": "제목 뒷부분 (8자이내)",
    "description": "발표 개요 (40자이내)",
    "subtitle": "부제목 (20자이내)"
  },
  "overview": {
    "title": "슬라이드 제목 (15자이내)",
    "section_title": "핵심 주제 문구 (15자이내)",
    "left_body": "왼쪽 본문. 3~4문장. 구체적 수치나 사례 포함. 반드시 180자 이상 200자 이내",
    "right_body": "오른쪽 본문. 3~4문장. 구체적 내용 포함. 반드시 180자 이상 200자 이내"
  },
  "overview2": {
    "title": "두번째 슬라이드 제목 (15자이내)",
    "section_title": "두번째 핵심 주제 (15자이내)",
    "left_body": "왼쪽 본문. 3~4문장. 반드시 180자 이상 200자 이내",
    "right_body": "오른쪽 본문. 3~4문장. 반드시 180자 이상 200자 이내"
  },
  "cards": {
    "title": "카드 슬라이드 제목 (15자이내)",
    "card1_title": "카드1 키워드 (7자이내)",
    "card1_body": "카드1 내용. 2~3문장. 75자이상 90자이내",
    "card2_title": "카드2 키워드 (7자이내)",
    "card2_body": "카드2 내용. 2~3문장. 75자이상 90자이내",
    "card3_title": "카드3 키워드 (7자이내)",
    "card3_body": "카드3 내용. 2~3문장. 75자이상 90자이내"
  },
  "keywords": {
    "title": "키워드 슬라이드 제목 (15자이내)",
    "label1": "라벨1 (5자이내)",
    "label2": "라벨2 (5자이내)",
    "label3": "라벨3 (5자이내)",
    "label4": "라벨4 (5자이내)",
    "keyword1": "키워드1 (5자이내)",
    "keyword2": "키워드2 (5자이내)",
    "keyword3": "키워드3 (5자이내)",
    "keyword4": "키워드4 (5자이내)",
    "summary": "핵심 요약 문장 (50자이내)"
  },
  "list": {
    "title": "리스트 슬라이드 제목 (15자이내)",
    "intro": "리스트 소개 문장 (45자이내)",
    "item1": "항목1 (25자이내)",
    "item2": "항목2 (25자이내)",
    "item3": "항목3 (25자이내)"
  },
  "analysis": {
    "title": "분석 슬라이드 제목 (15자이내)",
    "cause1_title": "원인1 (3자이내)",
    "cause1_body": "원인1 설명. 마침표로 끝나는 완결된 1문장. 40자이내",
    "cause2_title": "원인2 (3자이내)",
    "cause2_body": "원인2 설명. 마침표로 끝나는 완결된 1문장. 40자이내",
    "cause3_title": "원인3 (3자이내)",
    "cause3_body": "원인3 설명. 마침표로 끝나는 완결된 1문장. 40자이내",
    "result": "결과 키워드 (4자이내)",
    "result_body": "결과 설명. 각 문장은 반드시 마침표로 끝낼 것. 4~5문장. 150자이내"
  },
  "cards4": {
    "title": "4카드 슬라이드 제목 (15자이내)",
    "card1_title": "카드1 키워드. 반드시 5자이내. 절대 초과금지",
    "card2_title": "카드2 키워드. 반드시 5자이내. 절대 초과금지",
    "card3_title": "카드3 키워드. 반드시 5자이내. 절대 초과금지",
    "card4_title": "카드4 키워드. 반드시 5자이내. 절대 초과금지",
    "card1_body": "카드1 설명. 마침표로 끝나는 완결된 1~2문장. 50자이내",
    "card2_body": "카드2 설명. 마침표로 끝나는 완결된 1~2문장. 50자이내",
    "card3_body": "카드3 설명. 마침표로 끝나는 완결된 1~2문장. 50자이내",
    "card4_body": "카드4 설명. 마침표로 끝나는 완결된 1~2문장. 50자이내"
  },
  "timeline": {
    "title": "타임라인 슬라이드 제목 (15자이내)",
    "step1_title": "1단계 제목 (7자이내)",
    "step2_title": "2단계 제목 (7자이내)",
    "step3_title": "3단계 제목 (7자이내)",
    "step4_title": "4단계 제목 (7자이내)",
    "step1_body": "1단계 설명. 구체적 내용 포함한 완결된 1문장. 마침표로 끝낼 것. 40자이내",
    "step2_body": "2단계 설명. 구체적 내용 포함한 완결된 1문장. 마침표로 끝낼 것. 40자이내",
    "step3_body": "3단계 설명. 구체적 내용 포함한 완결된 1문장. 마침표로 끝낼 것. 40자이내",
    "step4_body": "4단계 설명. 구체적 내용 포함한 완결된 1문장. 마침표로 끝낼 것. 40자이내"
  }
}"""},
            {"role": "user", "content": f"키워드: {keyword}"}
        ]
    )
    clean = re.sub(r"```json|```", "", res.choices[0].message.content).strip()
    return json.loads(clean)


# ──────────────────────────────────────────────
# XML 헬퍼
# ──────────────────────────────────────────────
def find_shape(root, name):
    for sp in root.iter(f"{{{PNS}}}sp"):
        nvSpPr = sp.find(f"{{{PNS}}}nvSpPr")
        if nvSpPr is not None:
            cNvPr = nvSpPr.find(f"{{{PNS}}}cNvPr")
            if cNvPr is not None and cNvPr.get('name') == name:
                return sp
    return None

def set_text(root, name, txt):
    sp = find_shape(root, name)
    if sp is None:
        return

    # txBody: NS 먼저, 없으면 PNS
    txBody = sp.find(f"{{{NS}}}txBody")
    if txBody is None:
        txBody = sp.find(f"{{{PNS}}}txBody")
    if txBody is None:
        return

    paras = txBody.findall(f"{{{NS}}}p")
    if not paras:
        return

    # 첫 번째 단락 유지, 나머지 제거
    first_para = paras[0]
    for p in paras[1:]:
        txBody.remove(p)

    # 첫 번째 단락의 기존 run에서 rPr(글자스타일) 추출
    runs = first_para.findall(f"{{{NS}}}r")
    saved_rPr = None
    for r in runs:
        rPr = r.find(f"{{{NS}}}rPr")
        if rPr is not None:
            import copy
            saved_rPr = copy.deepcopy(rPr)
            break

    # 기존 run 전부 제거
    for r in runs:
        first_para.remove(r)
    # endParaRPr도 제거 (있으면)
    endPr = first_para.find(f"{{{NS}}}endParaRPr")
    if endPr is not None:
        first_para.remove(endPr)

    # run 하나 새로 생성
    new_r = etree.SubElement(first_para, f"{{{NS}}}r")
    if saved_rPr is not None:
        new_r.append(saved_rPr)
    new_t = etree.SubElement(new_r, f"{{{NS}}}t")
    new_t.text = txt.strip()

def s(d, k, lim):
    """글자수 한도 내에서 마지막 완결 문장까지만 반환 (본문용)"""
    text = (d.get(k) or "")[:lim]
    if not text:
        return text
    # 이미 완결 문자로 끝나면 그대로
    if text[-1] in '.!?':
        return text
    # 마지막 완결 지점 찾기 (우선순위 순)
    for punct in ['습니다.', '입니다.', '됩니다.', '있습니다.', '합니다.', '니다.', '다.', '요.', '.', '!', '?']:
        idx = text.rfind(punct)
        if idx != -1:
            return text[:idx + len(punct)]
    return text

def st_s(d, k, lim):
    """단순 글자수 슬라이스 (제목 등 문장 완결 불필요한 필드용)"""
    return (d.get(k) or "")[:lim]

def st_title(root, name, val):
    """제목 전용 set_text. 공백 패딩 1칸만 추가."""
    set_text(root, name, val + " ")

def _get_bodyPr(sp):
    """
    txBody 네임스페이스가 슬라이드마다 다를 수 있음.
    drawingml(NS) 먼저 시도, 없으면 presentationml(PNS) 시도.
    """
    txBody = sp.find(f"{{{NS}}}txBody")
    if txBody is None:
        txBody = sp.find(f"{{{PNS}}}txBody")
    if txBody is None:
        return None
    bodyPr = txBody.find(f"{{{NS}}}bodyPr")
    return bodyPr

def set_no_autofit(root, name):
    """텍스트 자동 축소 끄기 (제목 등 크기 고정이 필요한 TextBox용)."""
    for sp in root.iter(f"{{{PNS}}}sp"):
        nvSpPr = sp.find(f"{{{PNS}}}nvSpPr")
        if nvSpPr is None:
            continue
        cNvPr = nvSpPr.find(f"{{{PNS}}}cNvPr")
        if cNvPr is None or cNvPr.get("name") != name:
            continue
        bodyPr = _get_bodyPr(sp)
        if bodyPr is None:
            continue
        for tag in [f"{{{NS}}}normAutofit", f"{{{NS}}}spAutoFit"]:
            el = bodyPr.find(tag)
            if el is not None:
                bodyPr.remove(el)
        if bodyPr.find(f"{{{NS}}}noAutofit") is None:
            etree.SubElement(bodyPr, f"{{{NS}}}noAutofit")

def set_norm_autofit(root, name):
    """텍스트가 넘칠 때 폰트를 자동으로 줄여서 맞춤 (본문 TextBox용)."""
    for sp in root.iter(f"{{{PNS}}}sp"):
        nvSpPr = sp.find(f"{{{PNS}}}nvSpPr")
        if nvSpPr is None:
            continue
        cNvPr = nvSpPr.find(f"{{{PNS}}}cNvPr")
        if cNvPr is None or cNvPr.get("name") != name:
            continue
        bodyPr = _get_bodyPr(sp)
        if bodyPr is None:
            continue
        for tag in [f"{{{NS}}}noAutofit", f"{{{NS}}}spAutoFit"]:
            el = bodyPr.find(tag)
            if el is not None:
                bodyPr.remove(el)
        if bodyPr.find(f"{{{NS}}}normAutofit") is None:
            etree.SubElement(bodyPr, f"{{{NS}}}normAutofit")

def st(root, name, val):
    set_text(root, name, val)


# ──────────────────────────────────────────────
# 슬라이드별 fill 함수
# ──────────────────────────────────────────────
def fill_cover(root, data, keyword, team, today):
    c = data.get("cover", {})
    st_title(root, "TextBox 5",  st_s(c, "title_line1", 10))
    st_title(root, "TextBox 6",  st_s(c, "title_line2", 12))
    set_norm_autofit(root, "TextBox 5")
    set_norm_autofit(root, "TextBox 6")
    st(root, "TextBox 7",  s(c, "description", 40))
    st(root, "TextBox 8",  s(c, "subtitle", 20))
    st(root, "TextBox 9",  f"팀  {team}")
    st(root, "TextBox 10", today)
    st(root, "TextBox 11", "modui.ai")

def fill_overview(root, dk, data, label):
    o = data.get(dk, {})
    st_title(root, "TextBox 19", st_s(o, "title", 15))
    set_norm_autofit(root, "TextBox 19")
    st(root, "TextBox 20", "")
    st(root, "TextBox 21", label)
    st(root, "TextBox 22", s(o, "left_body", 200))
    st(root, "TextBox 23", s(o, "right_body", 200))
    st(root, "TextBox 24", st_s(o, "section_title", 15))

def fill_cards(root, dk, data, label):
    c = data.get(dk, {})
    st_title(root, "TextBox 17", st_s(c, "title", 15))
    set_norm_autofit(root, "TextBox 17")
    st(root, "TextBox 18", "")
    st(root, "TextBox 19", label)
    st(root, "TextBox 29", s(c, "card1_body", 95))
    st(root, "TextBox 30", s(c, "card2_body", 95))
    st(root, "TextBox 31", s(c, "card3_body", 95))
    st(root, "TextBox 32", st_s(c, "card1_title", 7))
    st(root, "TextBox 33", st_s(c, "card2_title", 7))
    st(root, "TextBox 34", st_s(c, "card3_title", 7))
    st(root, "TextBox 38", "Card 01")
    st(root, "TextBox 39", "Card 02")
    st(root, "TextBox 40", "Card 03")
    for box in ["TextBox 29", "TextBox 30", "TextBox 31",
                "TextBox 32", "TextBox 33", "TextBox 34"]:
        set_norm_autofit(root, box)

def fill_keywords(root, dk, data, label):
    k = data.get(dk, {})
    st_title(root, "TextBox 17", st_s(k, "title", 12))
    set_norm_autofit(root, "TextBox 17")
    st(root, "TextBox 18", "")
    st(root, "TextBox 19", label)
    st(root, "TextBox 39", s(k, "label1", 5))
    st(root, "TextBox 40", s(k, "label2", 5))
    st(root, "TextBox 41", s(k, "label3", 5))
    st(root, "TextBox 42", s(k, "label4", 5))
    st(root, "TextBox 43", s(k, "keyword1", 5))
    st(root, "TextBox 44", s(k, "keyword2", 5))
    st(root, "TextBox 45", s(k, "keyword3", 5))
    st(root, "TextBox 46", s(k, "keyword4", 5))
    st(root, "TextBox 51", s(k, "summary", 50))

def fill_list(root, dk, data, label):
    li = data.get(dk, {})
    st_title(root, "TextBox 17", st_s(li, "title", 15))
    set_norm_autofit(root, "TextBox 17")
    st(root, "TextBox 18", "")
    st(root, "TextBox 19", label)
    st(root, "TextBox 20", s(li, "intro", 45))
    st(root, "TextBox 30", s(li, "item1", 25))
    st(root, "TextBox 31", s(li, "item2", 25))
    st(root, "TextBox 32", s(li, "item3", 25))

def fill_analysis(root, dk, data, label):
    a = data.get(dk, {})
    st_title(root, "TextBox 17", st_s(a, "title", 15))
    set_norm_autofit(root, "TextBox 17")
    st(root, "TextBox 18", "")
    st(root, "TextBox 19", label)
    st(root, "TextBox 33", s(a, "cause1_body", 45))
    st(root, "TextBox 34", s(a, "cause2_body", 45))
    st(root, "TextBox 35", s(a, "cause3_body", 45))
    st(root, "TextBox 48", st_s(a, "cause1_title", 3))
    st(root, "TextBox 49", st_s(a, "cause2_title", 3))
    st(root, "TextBox 50", st_s(a, "cause3_title", 3))
    st(root, "TextBox 51", s(a, "result_body", 160))
    st(root, "TextBox 52", "분석 결과")
    for box in ["TextBox 33", "TextBox 34", "TextBox 35", "TextBox 51"]:
        set_norm_autofit(root, box)

def fill_cards4(root, dk, data, label):
    c = data.get(dk, {})
    st_title(root, "TextBox 17", st_s(c, "title", 15))
    set_norm_autofit(root, "TextBox 17")
    st(root, "TextBox 18", "")
    st(root, "TextBox 19", label)
    st(root, "TextBox 32", st_s(c, "card1_title", 5))
    st(root, "TextBox 33", st_s(c, "card2_title", 5))
    st(root, "TextBox 34", st_s(c, "card3_title", 5))
    st(root, "TextBox 35", st_s(c, "card4_title", 5))
    st(root, "TextBox 36", s(c, "card1_body", 55))
    st(root, "TextBox 37", s(c, "card2_body", 55))
    st(root, "TextBox 38", s(c, "card3_body", 55))
    st(root, "TextBox 39", s(c, "card4_body", 55))
    for box in ["TextBox 32", "TextBox 33", "TextBox 34", "TextBox 35",
                "TextBox 36", "TextBox 37", "TextBox 38", "TextBox 39"]:
        set_norm_autofit(root, box)

def fill_timeline(root, dk, data, label):
    t = data.get(dk, {})
    st_title(root, "TextBox 17", st_s(t, "title", 15))
    set_norm_autofit(root, "TextBox 17")
    st(root, "TextBox 18", "")
    st(root, "TextBox 19", label)
    st(root, "TextBox 25", st_s(t, "step1_title", 7))
    st(root, "TextBox 28", st_s(t, "step2_title", 7))
    st(root, "TextBox 30", st_s(t, "step3_title", 7))
    st(root, "TextBox 32", st_s(t, "step4_title", 7))
    st(root, "TextBox 26", s(t, "step1_body", 40))
    st(root, "TextBox 40", s(t, "step2_body", 40))
    st(root, "TextBox 31", s(t, "step3_body", 40))
    st(root, "TextBox 41", s(t, "step4_body", 40))
    for box in ["TextBox 17", "TextBox 25", "TextBox 28", "TextBox 30", "TextBox 32"]:
        set_no_autofit(root, box)
    for box in ["TextBox 26", "TextBox 40", "TextBox 31", "TextBox 41"]:
        set_norm_autofit(root, box)

def fill_outro(root, team, today):
    st(root, "TextBox 7",  "")
    st(root, "TextBox 8",  "")
    st(root, "TextBox 9",  f"팀  {team}")
    st(root, "TextBox 10", today)
    st(root, "TextBox 11", "modui.ai")

FILL = {
    "cover":     fill_cover,
    "overview":  fill_overview,
    "overview2": fill_overview,
    "cards":     fill_cards,
    "keywords":  fill_keywords,
    "list":      fill_list,
    "analysis":  fill_analysis,
    "cards4":    fill_cards4,
    "timeline":  fill_timeline,
    "outro":     fill_outro,
}


# ──────────────────────────────────────────────
# 슬라이드 복사 / 등록
# ──────────────────────────────────────────────
def copy_slide(unpacked, src, dst):
    sd = os.path.join(unpacked, "ppt", "slides")
    rd = os.path.join(sd, "_rels")
    shutil.copy(os.path.join(sd, src), os.path.join(sd, dst))
    sr = src + ".rels"
    dr = dst + ".rels"
    if os.path.exists(os.path.join(rd, sr)):
        shutil.copy(os.path.join(rd, sr), os.path.join(rd, dr))

def register_slide(fname, prs_root, rels_root):
    PRS2  = "http://schemas.openxmlformats.org/presentationml/2006/main"
    R2    = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    RELS2 = "http://schemas.openxmlformats.org/package/2006/relationships"
    max_rid = max(
        (int(r.get("Id", "rId0")[3:]) for r in rels_root.findall(f"{{{RELS2}}}Relationship")
         if r.get("Id", "").startswith("rId")),
        default=0
    )
    new_rid = f"rId{max_rid+1}"
    etree.SubElement(rels_root, f"{{{RELS2}}}Relationship",
                     {"Id": new_rid,
                      "Type": f"{R2}/slide",
                      "Target": f"slides/{fname}"})
    sld_lst = prs_root.find(f"{{{PRS2}}}sldIdLst")
    max_sid = max((int(s.get("id", "255")) for s in sld_lst), default=255)
    etree.SubElement(sld_lst, f"{{{PRS2}}}sldId",
                     {"id": str(max_sid + 1), f"{{{R2}}}id": new_rid})


# ──────────────────────────────────────────────
# 메인 엔드포인트
# ──────────────────────────────────────────────
@app.post("/generate-ppt")
def generate_ppt(req: PPTRequest, background_tasks: BackgroundTasks):
    keyword     = req.keyword
    team        = req.team or "딸깍"
    slide_count = req.slide_count or 5
    today       = date.today().strftime("%Y.%m.%d")

    best  = min(COMBOS, key=lambda x: abs(x - slide_count))
    combo = COMBOS[best]

    # GPT 호출 → 한자 후처리
    data = call_gpt(keyword)
    data = sanitize_data(data)
    print(json.dumps(data, ensure_ascii=False, indent=2))

    tmp_dir  = tempfile.mkdtemp()
    unpacked = os.path.join(tmp_dir, "unpacked")
    shutil.copy(TEMPLATE_PATH, os.path.join(tmp_dir, "output.pptx"))
    with zipfile.ZipFile(os.path.join(tmp_dir, "output.pptx"), "r") as z:
        z.extractall(unpacked)

    prs_path  = os.path.join(unpacked, "ppt", "presentation.xml")
    rels_path = os.path.join(unpacked, "ppt", "_rels", "presentation.xml.rels")
    with open(prs_path,  "rb") as f: prs_root  = etree.fromstring(f.read())
    with open(rels_path, "rb") as f: rels_root = etree.fromstring(f.read())

    PRS2  = "http://schemas.openxmlformats.org/presentationml/2006/main"
    R2    = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    RELS2 = "http://schemas.openxmlformats.org/package/2006/relationships"

    sld_lst = prs_root.find(f"{{{PRS2}}}sldIdLst")
    for e in list(sld_lst):
        sld_lst.remove(e)
    for r in list(rels_root.findall(f"{{{RELS2}}}Relationship")):
        t = r.get("Type", "")
        if "/slide" in t and "/slideLayout" not in t and "/slideMaster" not in t:
            rels_root.remove(r)

    used = {}
    num  = [0]
    def lbl():
        num[0] += 1
        return f"{num[0]:02d}"

    for tmpl, dk in combo:
        used[tmpl] = used.get(tmpl, 0) + 1
        actual = tmpl if used[tmpl] == 1 else tmpl.replace(".xml", f"_copy{used[tmpl]}.xml")
        if used[tmpl] > 1:
            copy_slide(unpacked, tmpl, actual)
        register_slide(actual, prs_root, rels_root)

        path = os.path.join(unpacked, "ppt", "slides", actual)
        with open(path, "rb") as f:
            xml = f.read()
        root = etree.fromstring(xml)

        fn = FILL.get(dk)
        if fn:
            if dk == "cover":
                fn(root, data, keyword, team, today)
            elif dk == "outro":
                fn(root, team, today)
            else:
                fn(root, dk, data, lbl())

        with open(path, "wb") as f:
            f.write(etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True))

    with open(prs_path,  "wb") as f:
        f.write(etree.tostring(prs_root,  xml_declaration=True, encoding="UTF-8", standalone=True))
    with open(rels_path, "wb") as f:
        f.write(etree.tostring(rels_root, xml_declaration=True, encoding="UTF-8", standalone=True))

    out_path = os.path.join(tmp_dir, f"{keyword}_발표자료.pptx")
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zout:
        for rd, _, files in os.walk(unpacked):
            for file in files:
                fp = os.path.join(rd, file)
                zout.write(fp, os.path.relpath(fp, unpacked))

    # ▼ 응답 전송 후 tmp_dir 자동 정리
    background_tasks.add_task(shutil.rmtree, tmp_dir, ignore_errors=True)

    return FileResponse(
        out_path,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=f"{keyword}_발표자료.pptx",
        background=background_tasks,
    )


# ──────────────────────────────────────────────
# 기타 엔드포인트
# ──────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "service": "모듀이 PPT 생성 API"}

@app.get("/api/meeting")
def meeting():
    return {"message": "회의록 AI 엔드포인트"}

@app.get("/api/output")
def output_api():
    return {"message": "산출물 AI 엔드포인트"}