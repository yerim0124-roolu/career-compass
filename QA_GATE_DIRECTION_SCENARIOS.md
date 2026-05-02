# Career Compass Gate x Direction QA Scenarios

- 생성 기준: `classification.ts`의 `classifyByGate` + `scoring.ts`의 `determineDirectionType` 조건을 코드 그대로 적용해 탐색
- 결과: 성립 조합 33개, 비성립 조합 9개

## 0) 비성립 조합 (코드 조건상 불가능)
- stable-maintain + 회복 재정비형
- move-while-working + 회복 재정비형
- accelerate-challenge + 전문가 성장형
- accelerate-challenge + 조직 성장형
- accelerate-challenge + 회복 재정비형
- accelerate-challenge + 안정 설계형
- prepare-then-switch + 회복 재정비형
- side-project-validation + 학습 전환형
- side-project-validation + 회복 재정비형

## 1) 성립 시나리오
### S01. stable-maintain + 독립 창업형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=5500000 (runway≈2.2)
- careerStatus: jobSat=4, growth=4, salarySat=5, wlb=4, orgStress=2, burnout=2, jobSearchConf=5
- traits: change=1, planning=3, curiosity=5, risk=3, recoveryNeed=2, selfEff=5, networking=4, meaning=2, outcomeExp=1, portfolio=1
- flow: change=3, stability=3, rest=3
- 근거: gate=stable-maintain 조건(주요: burnout=25.0, runway=2.2, MR=50.0, RB=62.5, ED=55.0) + direction=독립 창업형 우선 규칙 충족

### S02. stable-maintain + 전문가 성장형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=8750000 (runway≈3.5)
- careerStatus: jobSat=4, growth=5, salarySat=3, wlb=2, orgStress=2, burnout=2, jobSearchConf=3
- traits: change=1, planning=3, curiosity=4, risk=1, recoveryNeed=5, selfEff=3, networking=4, meaning=4, outcomeExp=4, portfolio=3
- flow: change=3, stability=3, rest=3
- 근거: gate=stable-maintain 조건(주요: burnout=59.2, runway=3.5, MR=61.2, RB=42.5, ED=30.0) + direction=전문가 성장형 우선 규칙 충족

### S03. stable-maintain + 조직 성장형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=25000000 (runway≈10)
- careerStatus: jobSat=4, growth=4, salarySat=5, wlb=5, orgStress=2, burnout=2, jobSearchConf=4
- traits: change=1, planning=4, curiosity=1, risk=3, recoveryNeed=4, selfEff=4, networking=4, meaning=4, outcomeExp=1, portfolio=1
- flow: change=3, stability=3, rest=3
- 근거: gate=stable-maintain 조건(주요: burnout=34.2, runway=10, MR=41.2, RB=52.5, ED=15.0) + direction=조직 성장형 우선 규칙 충족

### S04. stable-maintain + 학습 전환형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=15000000 (runway≈6)
- careerStatus: jobSat=5, growth=4, salarySat=3, wlb=1, orgStress=2, burnout=2, jobSearchConf=3
- traits: change=3, planning=5, curiosity=4, risk=1, recoveryNeed=2, selfEff=2, networking=4, meaning=5, outcomeExp=3, portfolio=5
- flow: change=3, stability=3, rest=3
- 근거: gate=stable-maintain 조건(주요: burnout=42.5, runway=6, MR=56.2, RB=47.5, ED=45.0) + direction=학습 전환형 우선 규칙 충족

### S05. stable-maintain + 안정 설계형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=8750000 (runway≈3.5)
- careerStatus: jobSat=1, growth=5, salarySat=4, wlb=4, orgStress=4, burnout=2, jobSearchConf=4
- traits: change=1, planning=2, curiosity=5, risk=1, recoveryNeed=4, selfEff=4, networking=3, meaning=2, outcomeExp=3, portfolio=5
- flow: change=3, stability=3, rest=3
- 근거: gate=stable-maintain 조건(주요: burnout=51.7, runway=3.5, MR=68.8, RB=45.0, ED=40.0) + direction=안정 설계형 우선 규칙 충족

### S06. move-while-working + 독립 창업형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=30000000 (runway≈12)
- careerStatus: jobSat=2, growth=2, salarySat=3, wlb=1, orgStress=1, burnout=4, jobSearchConf=1
- traits: change=2, planning=5, curiosity=1, risk=5, recoveryNeed=2, selfEff=3, networking=5, meaning=5, outcomeExp=4, portfolio=3
- flow: change=3, stability=3, rest=3
- 근거: gate=move-while-working 조건(주요: burnout=48.3, runway=12, MR=66.2, RB=57.5, ED=37.5) + direction=독립 창업형 우선 규칙 충족

### S07. move-while-working + 전문가 성장형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=30000000 (runway≈12)
- careerStatus: jobSat=4, growth=2, salarySat=1, wlb=3, orgStress=2, burnout=4, jobSearchConf=2
- traits: change=5, planning=2, curiosity=3, risk=1, recoveryNeed=3, selfEff=2, networking=5, meaning=4, outcomeExp=5, portfolio=1
- flow: change=3, stability=3, rest=3
- 근거: gate=move-while-working 조건(주요: burnout=50.0, runway=12, MR=53.8, RB=70.0, ED=50.0) + direction=전문가 성장형 우선 규칙 충족

### S08. move-while-working + 조직 성장형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=11250000 (runway≈4.5)
- careerStatus: jobSat=3, growth=3, salarySat=1, wlb=3, orgStress=3, burnout=2, jobSearchConf=1
- traits: change=4, planning=2, curiosity=1, risk=3, recoveryNeed=4, selfEff=4, networking=2, meaning=3, outcomeExp=5, portfolio=5
- flow: change=3, stability=3, rest=3
- 근거: gate=move-while-working 조건(주요: burnout=51.7, runway=4.5, MR=76.2, RB=60.0, ED=37.5) + direction=조직 성장형 우선 규칙 충족

### S09. move-while-working + 학습 전환형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=30000000 (runway≈12)
- careerStatus: jobSat=2, growth=3, salarySat=3, wlb=3, orgStress=2, burnout=2, jobSearchConf=5
- traits: change=3, planning=5, curiosity=4, risk=2, recoveryNeed=4, selfEff=4, networking=3, meaning=1, outcomeExp=3, portfolio=2
- flow: change=3, stability=3, rest=3
- 근거: gate=move-while-working 조건(주요: burnout=45.8, runway=12, MR=53.8, RB=60.0, ED=52.5) + direction=학습 전환형 우선 규칙 충족

### S10. move-while-working + 안정 설계형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=20000000 (runway≈8)
- careerStatus: jobSat=2, growth=1, salarySat=3, wlb=1, orgStress=3, burnout=1, jobSearchConf=4
- traits: change=2, planning=3, curiosity=4, risk=1, recoveryNeed=1, selfEff=5, networking=1, meaning=3, outcomeExp=5, portfolio=4
- flow: change=3, stability=3, rest=3
- 근거: gate=move-while-working 조건(주요: burnout=35.0, runway=8, MR=75.0, RB=47.5, ED=37.5) + direction=안정 설계형 우선 규칙 충족

### S11. accelerate-challenge + 독립 창업형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=30000000 (runway≈12)
- careerStatus: jobSat=4, growth=4, salarySat=2, wlb=5, orgStress=3, burnout=2, jobSearchConf=5
- traits: change=1, planning=5, curiosity=5, risk=5, recoveryNeed=2, selfEff=5, networking=5, meaning=3, outcomeExp=2, portfolio=3
- flow: change=3, stability=3, rest=3
- 근거: gate=accelerate-challenge 조건(주요: burnout=25.0, runway=12, MR=71.2, RB=70.0, ED=70.0) + direction=독립 창업형 우선 규칙 충족

### S12. accelerate-challenge + 학습 전환형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=25000000 (runway≈10)
- careerStatus: jobSat=3, growth=3, salarySat=4, wlb=4, orgStress=3, burnout=1, jobSearchConf=4
- traits: change=5, planning=5, curiosity=5, risk=1, recoveryNeed=5, selfEff=5, networking=5, meaning=2, outcomeExp=4, portfolio=5
- flow: change=3, stability=3, rest=3
- 근거: gate=accelerate-challenge 조건(주요: burnout=47.5, runway=10, MR=93.8, RB=100.0, ED=70.0) + direction=학습 전환형 우선 규칙 충족

### S13. recovery-first + 독립 창업형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=25000000 (runway≈10)
- careerStatus: jobSat=3, growth=1, salarySat=2, wlb=1, orgStress=4, burnout=5, jobSearchConf=3
- traits: change=2, planning=2, curiosity=5, risk=5, recoveryNeed=1, selfEff=5, networking=1, meaning=4, outcomeExp=1, portfolio=2
- flow: change=3, stability=3, rest=3
- 근거: gate=recovery-first 조건(주요: burnout=64.2, runway=10, MR=40.0, RB=47.5, ED=77.5) + direction=독립 창업형 우선 규칙 충족

### S14. recovery-first + 전문가 성장형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=25000000 (runway≈10)
- careerStatus: jobSat=1, growth=5, salarySat=4, wlb=1, orgStress=3, burnout=3, jobSearchConf=2
- traits: change=1, planning=4, curiosity=5, risk=3, recoveryNeed=5, selfEff=3, networking=4, meaning=4, outcomeExp=1, portfolio=3
- flow: change=3, stability=3, rest=3
- 근거: gate=recovery-first 조건(주요: burnout=76.7, runway=10, MR=42.5, RB=42.5, ED=55.0) + direction=전문가 성장형 우선 규칙 충족

### S15. recovery-first + 조직 성장형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=15000000 (runway≈6)
- careerStatus: jobSat=5, growth=3, salarySat=5, wlb=3, orgStress=4, burnout=5, jobSearchConf=5
- traits: change=4, planning=4, curiosity=2, risk=3, recoveryNeed=3, selfEff=3, networking=4, meaning=1, outcomeExp=1, portfolio=4
- flow: change=3, stability=3, rest=3
- 근거: gate=recovery-first 조건(주요: burnout=67.5, runway=6, MR=47.5, RB=65.0, ED=47.5) + direction=조직 성장형 우선 규칙 충족

### S16. recovery-first + 학습 전환형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=20000000 (runway≈8)
- careerStatus: jobSat=1, growth=3, salarySat=4, wlb=1, orgStress=4, burnout=1, jobSearchConf=1
- traits: change=3, planning=1, curiosity=5, risk=2, recoveryNeed=4, selfEff=2, networking=5, meaning=1, outcomeExp=5, portfolio=4
- flow: change=3, stability=3, rest=3
- 근거: gate=recovery-first 조건(주요: burnout=63.3, runway=8, MR=68.8, RB=55.0, ED=62.5) + direction=학습 전환형 우선 규칙 충족

### S17. recovery-first + 회복 재정비형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=11250000 (runway≈4.5)
- careerStatus: jobSat=2, growth=5, salarySat=3, wlb=1, orgStress=4, burnout=4, jobSearchConf=1
- traits: change=2, planning=3, curiosity=1, risk=3, recoveryNeed=4, selfEff=1, networking=5, meaning=2, outcomeExp=1, portfolio=5
- flow: change=3, stability=3, rest=3
- 근거: gate=recovery-first 조건(주요: burnout=80.8, runway=4.5, MR=40.0, RB=37.5, ED=22.5) + direction=회복 재정비형 우선 규칙 충족

### S18. recovery-first + 안정 설계형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=8750000 (runway≈3.5)
- careerStatus: jobSat=3, growth=2, salarySat=1, wlb=3, orgStress=4, burnout=2, jobSearchConf=1
- traits: change=2, planning=3, curiosity=1, risk=1, recoveryNeed=5, selfEff=4, networking=1, meaning=3, outcomeExp=5, portfolio=1
- flow: change=3, stability=3, rest=3
- 근거: gate=recovery-first 조건(주요: burnout=65.0, runway=3.5, MR=51.2, RB=37.5, ED=7.5) + direction=안정 설계형 우선 규칙 충족

### S19. prepare-then-switch + 독립 창업형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=30000000 (runway≈12)
- careerStatus: jobSat=3, growth=2, salarySat=3, wlb=4, orgStress=3, burnout=2, jobSearchConf=4
- traits: change=3, planning=5, curiosity=5, risk=5, recoveryNeed=5, selfEff=2, networking=2, meaning=4, outcomeExp=3, portfolio=5
- flow: change=3, stability=3, rest=3
- 근거: gate=prepare-then-switch 조건(주요: burnout=53.3, runway=12, MR=46.2, RB=32.5, ED=85.0) + direction=독립 창업형 우선 규칙 충족

### S20. prepare-then-switch + 전문가 성장형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=30000000 (runway≈12)
- careerStatus: jobSat=4, growth=1, salarySat=3, wlb=5, orgStress=1, burnout=3, jobSearchConf=3
- traits: change=2, planning=4, curiosity=3, risk=4, recoveryNeed=1, selfEff=3, networking=2, meaning=5, outcomeExp=4, portfolio=4
- flow: change=3, stability=3, rest=3
- 근거: gate=prepare-then-switch 조건(주요: burnout=11.7, runway=12, MR=56.2, RB=35.0, ED=50.0) + direction=전문가 성장형 우선 규칙 충족

### S21. prepare-then-switch + 조직 성장형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=8750000 (runway≈3.5)
- careerStatus: jobSat=3, growth=4, salarySat=3, wlb=4, orgStress=1, burnout=5, jobSearchConf=1
- traits: change=2, planning=3, curiosity=3, risk=4, recoveryNeed=1, selfEff=2, networking=4, meaning=2, outcomeExp=3, portfolio=5
- flow: change=3, stability=3, rest=3
- 근거: gate=prepare-then-switch 조건(주요: burnout=29.2, runway=3.5, MR=56.2, RB=40.0, ED=50.0) + direction=조직 성장형 우선 규칙 충족

### S22. prepare-then-switch + 학습 전환형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=15000000 (runway≈6)
- careerStatus: jobSat=4, growth=1, salarySat=1, wlb=5, orgStress=2, burnout=4, jobSearchConf=3
- traits: change=4, planning=2, curiosity=4, risk=1, recoveryNeed=1, selfEff=1, networking=1, meaning=2, outcomeExp=3, portfolio=3
- flow: change=3, stability=3, rest=3
- 근거: gate=prepare-then-switch 조건(주요: burnout=23.3, runway=6, MR=22.5, RB=22.5, ED=52.5) + direction=학습 전환형 우선 규칙 충족

### S23. prepare-then-switch + 안정 설계형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=11250000 (runway≈4.5)
- careerStatus: jobSat=5, growth=1, salarySat=2, wlb=4, orgStress=5, burnout=1, jobSearchConf=2
- traits: change=2, planning=4, curiosity=5, risk=3, recoveryNeed=5, selfEff=2, networking=3, meaning=1, outcomeExp=1, portfolio=5
- flow: change=3, stability=3, rest=3
- 근거: gate=prepare-then-switch 조건(주요: burnout=59.2, runway=4.5, MR=38.8, RB=32.5, ED=62.5) + direction=안정 설계형 우선 규칙 충족

### S24. side-project-validation + 독립 창업형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=11250000 (runway≈4.5)
- careerStatus: jobSat=1, growth=3, salarySat=5, wlb=3, orgStress=1, burnout=5, jobSearchConf=4
- traits: change=4, planning=5, curiosity=5, risk=5, recoveryNeed=4, selfEff=2, networking=1, meaning=2, outcomeExp=4, portfolio=3
- flow: change=3, stability=3, rest=3
- 근거: gate=side-project-validation 조건(주요: burnout=57.5, runway=4.5, MR=37.5, RB=32.5, ED=92.5) + direction=독립 창업형 우선 규칙 충족

### S25. side-project-validation + 전문가 성장형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=15000000 (runway≈6)
- careerStatus: jobSat=5, growth=2, salarySat=3, wlb=4, orgStress=4, burnout=3, jobSearchConf=4
- traits: change=4, planning=1, curiosity=4, risk=4, recoveryNeed=1, selfEff=1, networking=3, meaning=2, outcomeExp=1, portfolio=3
- flow: change=3, stability=3, rest=3
- 근거: gate=side-project-validation 조건(주요: burnout=35.0, runway=6, MR=20.0, RB=37.5, ED=75.0) + direction=전문가 성장형 우선 규칙 충족

### S26. side-project-validation + 조직 성장형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=7000000 (runway≈2.8)
- careerStatus: jobSat=4, growth=3, salarySat=1, wlb=3, orgStress=4, burnout=1, jobSearchConf=4
- traits: change=5, planning=5, curiosity=5, risk=4, recoveryNeed=1, selfEff=1, networking=3, meaning=2, outcomeExp=5, portfolio=5
- flow: change=3, stability=3, rest=3
- 근거: gate=side-project-validation 조건(주요: burnout=29.2, runway=2.8, MR=55.0, RB=45.0, ED=92.5) + direction=조직 성장형 우선 규칙 충족

### S27. side-project-validation + 안정 설계형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=11250000 (runway≈4.5)
- careerStatus: jobSat=2, growth=3, salarySat=1, wlb=5, orgStress=3, burnout=4, jobSearchConf=2
- traits: change=1, planning=4, curiosity=5, risk=4, recoveryNeed=1, selfEff=1, networking=1, meaning=2, outcomeExp=3, portfolio=5
- flow: change=3, stability=3, rest=3
- 근거: gate=side-project-validation 조건(주요: burnout=29.2, runway=4.5, MR=32.5, RB=0.0, ED=62.5) + direction=안정 설계형 우선 규칙 충족

### S28. hold-and-review + 독립 창업형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=3000000 (runway≈1.2)
- careerStatus: jobSat=2, growth=5, salarySat=2, wlb=3, orgStress=4, burnout=2, jobSearchConf=4
- traits: change=1, planning=4, curiosity=2, risk=5, recoveryNeed=1, selfEff=1, networking=5, meaning=5, outcomeExp=4, portfolio=2
- flow: change=3, stability=3, rest=3
- 근거: gate=hold-and-review 조건(주요: burnout=35.0, runway=1.2, MR=43.8, RB=30.0, ED=40.0) + direction=독립 창업형 우선 규칙 충족

### S29. hold-and-review + 전문가 성장형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=4500000 (runway≈1.8)
- careerStatus: jobSat=5, growth=1, salarySat=5, wlb=1, orgStress=3, burnout=1, jobSearchConf=4
- traits: change=1, planning=1, curiosity=5, risk=2, recoveryNeed=3, selfEff=2, networking=1, meaning=5, outcomeExp=4, portfolio=5
- flow: change=3, stability=3, rest=3
- 근거: gate=hold-and-review 조건(주요: burnout=50.0, runway=1.8, MR=47.5, RB=10.0, ED=47.5) + direction=전문가 성장형 우선 규칙 충족

### S30. hold-and-review + 조직 성장형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=5500000 (runway≈2.2)
- careerStatus: jobSat=5, growth=1, salarySat=3, wlb=4, orgStress=4, burnout=1, jobSearchConf=4
- traits: change=3, planning=1, curiosity=3, risk=2, recoveryNeed=2, selfEff=4, networking=2, meaning=2, outcomeExp=1, portfolio=5
- flow: change=3, stability=3, rest=3
- 근거: gate=hold-and-review 조건(주요: burnout=30.8, runway=2.2, MR=51.2, RB=52.5, ED=42.5) + direction=조직 성장형 우선 규칙 충족

### S31. hold-and-review + 학습 전환형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=7000000 (runway≈2.8)
- careerStatus: jobSat=1, growth=5, salarySat=2, wlb=1, orgStress=4, burnout=5, jobSearchConf=3
- traits: change=5, planning=5, curiosity=4, risk=3, recoveryNeed=1, selfEff=1, networking=4, meaning=2, outcomeExp=4, portfolio=1
- flow: change=3, stability=3, rest=3
- 근거: gate=hold-and-review 조건(주요: burnout=64.2, runway=2.8, MR=33.8, RB=52.5, ED=75.0) + direction=학습 전환형 우선 규칙 충족

### S32. hold-and-review + 회복 재정비형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=7000000 (runway≈2.8)
- careerStatus: jobSat=4, growth=2, salarySat=5, wlb=3, orgStress=4, burnout=5, jobSearchConf=3
- traits: change=4, planning=4, curiosity=1, risk=4, recoveryNeed=4, selfEff=3, networking=2, meaning=3, outcomeExp=3, portfolio=4
- flow: change=3, stability=3, rest=3
- 근거: gate=hold-and-review 조건(주요: burnout=75.0, runway=2.8, MR=50.0, RB=50.0, ED=45.0) + direction=회복 재정비형 우선 규칙 충족

### S33. hold-and-review + 안정 설계형
- basicProfile: age=30, exp=6, annualSalary=60000000, monthlyExpense=2500000, savings=7000000 (runway≈2.8)
- careerStatus: jobSat=4, growth=2, salarySat=1, wlb=5, orgStress=1, burnout=1, jobSearchConf=3
- traits: change=1, planning=4, curiosity=4, risk=1, recoveryNeed=5, selfEff=1, networking=1, meaning=3, outcomeExp=4, portfolio=4
- flow: change=3, stability=3, rest=3
- 근거: gate=hold-and-review 조건(주요: burnout=30.0, runway=2.8, MR=33.8, RB=0.0, ED=30.0) + direction=안정 설계형 우선 규칙 충족

## 2) 요청하신 필수 비교 케이스
- recovery-first 60~74 vs 75+:
  - 60~74 예시: S13 (burnoutPressure=64.2, runway=10 → recovery-first)
  - 75+ 예시: S14 (burnoutPressure=76.7, runway=10 → recovery-first)
- side-project-validation (창업 성향 + 짧은 런웨이): S26 (ED=92.5, riskTolerance=5, runway=4.5)
- hold-and-review (런웨이 < 2개월): S30 (runway=1.2), S31 (runway=1.8)
- 같은 방향성의 게이트 분기(독립 창업형):
  - accelerate-challenge: S11 (runway=12, MR/RB/ED 모두 고점)
  - side-project-validation: S26 (runway=4.5, 창업 드라이브는 높지만 9개월 미만)
  - hold-and-review: S30 (runway=1.2)