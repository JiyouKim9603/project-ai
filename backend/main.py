from fastapi import FastAPI
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

NS  = "http://schemas.openxmlformats.org/drawingml/2006/main"
PNS = "http://schemas.openxmlformats.org/presentationml/2006/main"
RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

class PPTRequest(BaseModel):
    keyword: str
    team: Optional[str] = "딸깍"
    slide_count: Optional[int] = 5

COMBO_3  = [("slide1.xml","cover"),("slide4.xml","cards"),("slide15.xml","outro")]
COMBO_5  = [("slide1.xml","cover"),("slide2.xml","overview"),("slide4.xml","cards"),("slide8.xml","analysis"),("slide15.xml","outro")]
COMBO_7  = [("slide1.xml","cover"),("slide2.xml","overview"),("slide4.xml","cards"),("slide7.xml","list"),("slide8.xml","analysis"),("slide10.xml","cards4"),("slide15.xml","outro")]
COMBO_10 = [("slide1.xml","cover"),("slide2.xml","overview"),("slide4.xml","cards"),("slide6.xml","keywords"),("slide7.xml","list"),("slide8.xml","analysis"),("slide10.xml","cards4"),("slide11.xml","timeline"),("slide2.xml","overview2"),("slide15.xml","outro")]
COMBOS   = {3:COMBO_3,5:COMBO_5,7:COMBO_7,10:COMBO_10}

def call_gpt(keyword):
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role":"system","content":"""당신은 프레젠테이션 콘텐츠 작성 전문가입니다. 키워드를 받아 풍부하고 상세한 내용의 JSON을 생성하세요.
반드시 아래 규칙을 따르세요:
1. JSON만 반환, 다른 텍스트 절대 금지
2. 본문(body) 필드는 반드시 2~4문장으로 충분히 상세하게 작성
3. 글자수 제한은 최대값이며, 가능한 최대한 채워서 작성
4. 내용이 부실하거나 짧으면 안됨

{
  "cover": {
    "title_line1": "제목 앞부분 (8자이내, 핵심 명사)",
    "title_line2": "제목 뒷부분 (10자이내, 핵심 명사)",
    "description": "발표 개요. 이 발표의 목적과 내용을 설명하는 완전한 문장 (50자이내)",
    "subtitle": "부제목. 발표의 핵심을 한줄로 (25자이내)"
  },
  "overview": {
    "title": "슬라이드 제목 (15자이내)",
    "section_title": "핵심 주제를 명확하게 표현한 문구 (20자이내)",
    "left_body": "왼쪽 본문. 주제의 배경과 현황을 3~4문장으로 상세하게 작성. 구체적 수치나 사례 포함 권장. 반드시 150자 이상 작성",
    "right_body": "오른쪽 본문. 주제의 효과, 방법, 전망을 3~4문장으로 상세하게 작성. 구체적 내용 포함. 반드시 150자 이상 작성"
  },
  "overview2": {
    "title": "두번째 슬라이드 제목 (15자이내)",
    "section_title": "두번째 핵심 주제 문구 (20자이내)",
    "left_body": "왼쪽 본문. 첫번째 개요와 다른 관점으로 3~4문장 상세 작성. 반드시 150자 이상",
    "right_body": "오른쪽 본문. 3~4문장 상세 작성. 반드시 150자 이상"
  },
  "cards": {
    "title": "카드 슬라이드 제목 (15자이내)",
    "card1_title": "카드1 핵심 키워드 (6자이내)",
    "card1_body": "카드1 내용. 2~3문장으로 상세하게. 구체적 설명 포함. 반드시 70자 이상",
    "card2_title": "카드2 핵심 키워드 (6자이내)",
    "card2_body": "카드2 내용. 2~3문장으로 상세하게. 반드시 70자 이상",
    "card3_title": "카드3 핵심 키워드 (6자이내)",
    "card3_body": "카드3 내용. 2~3문장으로 상세하게. 반드시 70자 이상"
  },
  "keywords": {
    "title": "키워드 슬라이드 제목 (15자이내)",
    "label1": "분류 라벨1 (6자이내)",
    "label2": "분류 라벨2 (6자이내)",
    "label3": "분류 라벨3 (6자이내)",
    "label4": "분류 라벨4 (6자이내)",
    "keyword1": "핵심 키워드1 (6자이내)",
    "keyword2": "핵심 키워드2 (6자이내)",
    "keyword3": "핵심 키워드3 (6자이내)",
    "keyword4": "핵심 키워드4 (6자이내)",
    "summary": "전체 핵심을 요약하는 완전한 문장 (60자이내)"
  },
  "list": {
    "title": "리스트 슬라이드 제목 (15자이내)",
    "intro": "리스트 주제를 소개하는 완전한 문장 (60자이내)",
    "item1": "첫번째 항목. 구체적으로 (30자이내)",
    "item2": "두번째 항목. 구체적으로 (30자이내)",
    "item3": "세번째 항목. 구체적으로 (30자이내)"
  },
  "analysis": {
    "title": "분석 슬라이드 제목 (15자이내)",
    "cause1_title": "원인1 키워드 (4자이내)",
    "cause1_body": "원인1 상세 설명. 구체적으로 1~2문장 (45자이내)",
    "cause2_title": "원인2 키워드 (4자이내)",
    "cause2_body": "원인2 상세 설명. 구체적으로 1~2문장 (45자이내)",
    "cause3_title": "원인3 키워드 (4자이내)",
    "cause3_body": "원인3 상세 설명. 구체적으로 1~2문장 (45자이내)",
    "result": "결과 핵심 키워드 (6자이내)",
    "result_body": "결과 상세 설명. 2문장으로 구체적으로 (70자이내)"
  },
  "cards4": {
    "title": "4카드 슬라이드 제목 (15자이내)",
    "card1_title": "카드1 키워드 (6자이내)",
    "card2_title": "카드2 키워드 (6자이내)",
    "card3_title": "카드3 키워드 (6자이내)",
    "card4_title": "카드4 키워드 (6자이내)",
    "card1_body": "카드1 설명. 2문장으로 구체적으로 (50자이내)",
    "card2_body": "카드2 설명. 2문장으로 구체적으로 (50자이내)",
    "card3_body": "카드3 설명. 2문장으로 구체적으로 (50자이내)",
    "card4_body": "카드4 설명. 2문장으로 구체적으로 (50자이내)"
  },
  "timeline": {
    "title": "타임라인 슬라이드 제목 (15자이내)",
    "step1_title": "1단계 제목 (8자이내)",
    "step2_title": "2단계 제목 (8자이내)",
    "step3_title": "3단계 제목 (8자이내)",
    "step4_title": "4단계 제목 (8자이내)",
    "step1_body": "1단계 설명. 구체적으로 (30자이내)",
    "step2_body": "2단계 설명. 구체적으로 (30자이내)",
    "step3_body": "3단계 설명. 구체적으로 (30자이내)",
    "step4_body": "4단계 설명. 구체적으로 (30자이내)"
  }
}"""},
            {"role":"user","content":f"키워드: {keyword}"}
        ]
    )
    clean = re.sub(r"```json|```","", res.choices[0].message.content).strip()
    return json.loads(clean)

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
    if sp is None: return
    paras = list(sp.iter(f"{{{NS}}}p"))
    if not paras: return
    first_para = paras[0]
    runs = first_para.findall(f"{{{NS}}}r")
    if runs:
        t = runs[0].find(f"{{{NS}}}t")
        if t is not None: t.text = txt
        for r in runs[1:]: first_para.remove(r)
    else:
        r = etree.SubElement(first_para, f"{{{NS}}}r")
        t = etree.SubElement(r, f"{{{NS}}}t")
        t.text = txt
    for p in paras[1:]:
        if p.getparent() is not None: p.getparent().remove(p)

def s(d, k, lim):
    return (d.get(k) or "")[:lim]

def st(root, name, val): set_text(root, name, val)

def fill_cover(root, data, keyword, team, today):
    c = data.get("cover", {})
    st(root,"TextBox 5",  s(c,"title_line1",8))
    st(root,"TextBox 6",  s(c,"title_line2",10))
    st(root,"TextBox 7",  s(c,"description",50))
    st(root,"TextBox 8",  s(c,"subtitle",25))
    st(root,"TextBox 9",  f"팀  {team}")
    st(root,"TextBox 10", today)
    st(root,"TextBox 11", "modui.ai")

def fill_overview(root, dk, data, label):
    o = data.get(dk, {})
    st(root,"TextBox 19", s(o,"title",15))
    st(root,"TextBox 20", "")
    st(root,"TextBox 21", label)
    st(root,"TextBox 22", s(o,"left_body",200))
    st(root,"TextBox 23", s(o,"right_body",200))
    st(root,"TextBox 24", s(o,"section_title",20))

def fill_cards(root, dk, data, label):
    c = data.get(dk, {})
    st(root,"TextBox 17", s(c,"title",15))
    st(root,"TextBox 18", "")
    st(root,"TextBox 19", label)
    st(root,"TextBox 29", s(c,"card1_body",100))
    st(root,"TextBox 30", s(c,"card2_body",100))
    st(root,"TextBox 31", s(c,"card3_body",100))
    st(root,"TextBox 32", s(c,"card1_title",6))
    st(root,"TextBox 33", s(c,"card2_title",6))
    st(root,"TextBox 34", s(c,"card3_title",6))
    st(root,"TextBox 38", "Card 01")
    st(root,"TextBox 39", "Card 02")
    st(root,"TextBox 40", "Card 03")

def fill_keywords(root, dk, data, label):
    k = data.get(dk, {})
    st(root,"TextBox 17", s(k,"title",15))
    st(root,"TextBox 18", "")
    st(root,"TextBox 19", label)
    st(root,"TextBox 39", s(k,"label1",6))
    st(root,"TextBox 40", s(k,"label2",6))
    st(root,"TextBox 41", s(k,"label3",6))
    st(root,"TextBox 42", s(k,"label4",6))
    st(root,"TextBox 43", s(k,"keyword1",6))
    st(root,"TextBox 44", s(k,"keyword2",6))
    st(root,"TextBox 45", s(k,"keyword3",6))
    st(root,"TextBox 46", s(k,"keyword4",6))
    st(root,"TextBox 51", s(k,"summary",60))

def fill_list(root, dk, data, label):
    li = data.get(dk, {})
    st(root,"TextBox 17", s(li,"title",15))
    st(root,"TextBox 18", "")
    st(root,"TextBox 19", label)
    st(root,"TextBox 20", s(li,"intro",60))
    st(root,"TextBox 30", s(li,"item1",30))
    st(root,"TextBox 31", s(li,"item2",30))
    st(root,"TextBox 32", s(li,"item3",30))

def fill_analysis(root, dk, data, label):
    a = data.get(dk, {})
    st(root,"TextBox 17", s(a,"title",15))
    st(root,"TextBox 18", "")
    st(root,"TextBox 19", label)
    st(root,"TextBox 33", s(a,"cause1_body",45))
    st(root,"TextBox 34", s(a,"cause2_body",45))
    st(root,"TextBox 35", s(a,"cause3_body",45))
    st(root,"TextBox 48", s(a,"cause1_title",4))
    st(root,"TextBox 49", s(a,"cause2_title",4))
    st(root,"TextBox 50", s(a,"cause3_title",4))
    st(root,"TextBox 51", s(a,"result_body",70))
    st(root,"TextBox 52", s(a,"result",6))

def fill_cards4(root, dk, data, label):
    c = data.get(dk, {})
    st(root,"TextBox 17", s(c,"title",15))
    st(root,"TextBox 18", "")
    st(root,"TextBox 19", label)
    st(root,"TextBox 32", s(c,"card1_title",6))
    st(root,"TextBox 33", s(c,"card2_title",6))
    st(root,"TextBox 34", s(c,"card3_title",6))
    st(root,"TextBox 35", s(c,"card4_title",6))
    st(root,"TextBox 36", s(c,"card1_body",50))
    st(root,"TextBox 37", s(c,"card2_body",50))
    st(root,"TextBox 38", s(c,"card3_body",50))
    st(root,"TextBox 39", s(c,"card4_body",50))

def fill_timeline(root, dk, data, label):
    t = data.get(dk, {})
    st(root,"TextBox 17", s(t,"title",15))
    st(root,"TextBox 18", "")
    st(root,"TextBox 19", label)
    st(root,"TextBox 25", s(t,"step1_title",8))
    st(root,"TextBox 28", s(t,"step2_title",8))
    st(root,"TextBox 30", s(t,"step3_title",8))
    st(root,"TextBox 32", s(t,"step4_title",8))
    st(root,"TextBox 26", s(t,"step1_body",30))
    st(root,"TextBox 40", s(t,"step2_body",30))
    st(root,"TextBox 31", s(t,"step3_body",30))
    st(root,"TextBox 42", s(t,"step4_body",30))

def fill_outro(root, team, today):
    st(root,"TextBox 7",  "")
    st(root,"TextBox 8",  "")
    st(root,"TextBox 9",  f"팀  {team}")
    st(root,"TextBox 10", today)
    st(root,"TextBox 11", "modui.ai")

FILL = {
    "cover":    fill_cover,
    "overview": fill_overview,  "overview2": fill_overview,
    "cards":    fill_cards,
    "keywords": fill_keywords,
    "list":     fill_list,
    "analysis": fill_analysis,
    "cards4":   fill_cards4,
    "timeline": fill_timeline,
    "outro":    fill_outro,
}

def copy_slide(unpacked, src, dst):
    sd = os.path.join(unpacked,"ppt","slides")
    rd = os.path.join(sd,"_rels")
    shutil.copy(os.path.join(sd,src), os.path.join(sd,dst))
    sr = src+".rels"; dr = dst+".rels"
    if os.path.exists(os.path.join(rd,sr)):
        shutil.copy(os.path.join(rd,sr), os.path.join(rd,dr))

def register_slide(fname, prs_root, rels_root):
    PRS2="http://schemas.openxmlformats.org/presentationml/2006/main"
    R2="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    RELS2="http://schemas.openxmlformats.org/package/2006/relationships"
    max_rid = max((int(r.get("Id","rId0")[3:]) for r in rels_root.findall(f"{{{RELS2}}}Relationship") if r.get("Id","").startswith("rId")), default=0)
    new_rid = f"rId{max_rid+1}"
    etree.SubElement(rels_root, f"{{{RELS2}}}Relationship", {"Id":new_rid,"Type":f"{R2}/slide","Target":f"slides/{fname}"})
    sld_lst = prs_root.find(f"{{{PRS2}}}sldIdLst")
    max_sid = max((int(s.get("id","255")) for s in sld_lst), default=255)
    etree.SubElement(sld_lst, f"{{{PRS2}}}sldId", {"id":str(max_sid+1), f"{{{R2}}}id":new_rid})

@app.post("/generate-ppt")
def generate_ppt(req: PPTRequest):
    keyword     = req.keyword
    team        = req.team or "딸깍"
    slide_count = req.slide_count or 5
    today       = date.today().strftime("%Y.%m.%d")

    best  = min(COMBOS, key=lambda x: abs(x-slide_count))
    combo = COMBOS[best]
    data  = call_gpt(keyword)

    tmp_dir  = tempfile.mkdtemp()
    unpacked = os.path.join(tmp_dir,"unpacked")
    shutil.copy(TEMPLATE_PATH, os.path.join(tmp_dir,"output.pptx"))
    with zipfile.ZipFile(os.path.join(tmp_dir,"output.pptx"),"r") as z:
        z.extractall(unpacked)

    prs_path  = os.path.join(unpacked,"ppt","presentation.xml")
    rels_path = os.path.join(unpacked,"ppt","_rels","presentation.xml.rels")
    with open(prs_path,"rb")  as f: prs_root  = etree.fromstring(f.read())
    with open(rels_path,"rb") as f: rels_root = etree.fromstring(f.read())

    PRS2="http://schemas.openxmlformats.org/presentationml/2006/main"
    R2="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    RELS2="http://schemas.openxmlformats.org/package/2006/relationships"

    sld_lst = prs_root.find(f"{{{PRS2}}}sldIdLst")
    for e in list(sld_lst): sld_lst.remove(e)
    for r in list(rels_root.findall(f"{{{RELS2}}}Relationship")):
        t = r.get("Type","")
        if "/slide" in t and "/slideLayout" not in t and "/slideMaster" not in t:
            rels_root.remove(r)

    used = {}
    num  = [0]
    def lbl(): num[0]+=1; return f"{num[0]:02d}"

    for tmpl, dk in combo:
        used[tmpl] = used.get(tmpl,0)+1
        actual = tmpl if used[tmpl]==1 else tmpl.replace(".xml",f"_copy{used[tmpl]}.xml")
        if used[tmpl] > 1: copy_slide(unpacked, tmpl, actual)
        register_slide(actual, prs_root, rels_root)

        path = os.path.join(unpacked,"ppt","slides",actual)
        with open(path,"rb") as f: xml = f.read()
        root = etree.fromstring(xml)

        fn = FILL.get(dk)
        if fn:
            if dk=="cover": fn(root,data,keyword,team,today)
            elif dk=="outro": fn(root,team,today)
            else: fn(root,dk,data,lbl())

        with open(path,"wb") as f:
            f.write(etree.tostring(root,xml_declaration=True,encoding="UTF-8",standalone=True))

    with open(prs_path,"wb")  as f: f.write(etree.tostring(prs_root, xml_declaration=True,encoding="UTF-8",standalone=True))
    with open(rels_path,"wb") as f: f.write(etree.tostring(rels_root,xml_declaration=True,encoding="UTF-8",standalone=True))

    out_path = os.path.join(tmp_dir,f"{keyword}_발표자료.pptx")
    with zipfile.ZipFile(out_path,"w",zipfile.ZIP_DEFLATED) as zout:
        for rd,_,files in os.walk(unpacked):
            for file in files:
                fp=os.path.join(rd,file)
                zout.write(fp,os.path.relpath(fp,unpacked))

    return FileResponse(out_path,media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",filename=f"{keyword}_발표자료.pptx")

@app.get("/")
def root(): return {"status":"ok","service":"모듀이 PPT 생성 API"}
@app.get("/api/meeting")
def meeting(): return {"message":"회의록 AI 엔드포인트"}
@app.get("/api/output")
def output_api(): return {"message":"산출물 AI 엔드포인트"}